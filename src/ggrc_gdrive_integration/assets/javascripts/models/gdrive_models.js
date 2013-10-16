/*
 * Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
 * Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 * Created By: Bradley Momberger
 * Maintained By: Bradley Momberger
 */

(function(can) {

window.process_gapi_query = function(params) {
  var qstr = [];
  for(var i in params) {
    switch(i) {
      case 'parents' :
        qstr.push("'" + params[i] + "' in " + i);
        break;
      case 'mimeType' :
        qstr.push(i + " = '" + params[i] + "'");
        break;
      case 'mimeTypeNot' :
        qstr.push("mimeType != '" + params[i] + "'");
        break;
    }
  }
  return qstr.join(" and ");
};

var gdrive_findAll = function(extra_params, extra_path) {
  return function(params) {
    return window.oauth_dfd.then(function() {
      var dfd = new $.Deferred();
      if(params.parentfolderid) {
        params.parents = params.parentfolderid ;
        delete params.parentfolderid;
      }
      if(!params.parents) {
        params.parents = GGRC.config.GDRIVE_ROOT_FOLDER;
      }
      $.extend(params, extra_params);
      var q = process_gapi_query(params);

      var path = "/drive/v2/files";
      if(params.id) {
        path += "/" + params.id;
      }
      if(extra_path) {
        path += extra_path;
      }
      if(q) {
        path += "?q=" + encodeURIComponent(q);
      }

      gapi.client.request({
        path : path
        , method : "get" //"post"
        , callback : function(result) {
          if(!result) {
            dfd.reject(JSON.parse(arguments[1]));
          } else {
            var objs = result.items;
            can.each(objs, function(obj) {
              obj.selfLink = obj.selfLink || "#";
            });
            dfd.resolve(objs);
          }
        }
      });
      return dfd;
    });
  };
};
can.Model.Cacheable("CMS.Models.GDriveFile", {

  findAll : gdrive_findAll({ mimeTypeNot : "application/vnd.google-apps.folder" })

  , removeFromParent : function(object, parent_id) {
    if(typeof object !== "object") {
      object = this.store[object];
    }
    return window.oauth_dfd.then(function() {

      var dfd = new $.Deferred();

      gapi.client.request({
        path : "/drive/v2/files/" + parent_id + "/children/" + object.id
        , method : "delete"
        , callback : function(result) {
          if(result.error) {
            dfd.reject(dfd, result.error.status, result.error);
          } else {
            dfd.resolve();
          }
        }
      });
      return dfd;
    }).done(function() {
      object.refresh();
    });
  }
  , destroy : function(id) {
    return window.oauth_dfd.then(function() {

      var dfd = new $.Deferred();

      gapi.client.request({
        path : "/drive/v2/files/" + id + "/trash"
        , method : "post"
        , callback : function(result) {
          if(result.error) {
            dfd.reject(dfd, result.error.status, result.error);
          } else {
            dfd.resolve(result);
          }
        }
      });
      return dfd;
    });
  }

  , from_id : function(id) {
    return new this({ id : id });
  }

}, {
  findPermissions : function() {
    return CMS.Models.GDriveFilePermission.findAll(this.serialize());
  }

});

CMS.Models.GDriveFile("CMS.Models.GDriveFolder", {

  findAll : gdrive_findAll({ mimeType : "application/vnd.google-apps.folder"})
  
  , findOne : function(params, success, error) {
    return this.findAll(params).then(function(data) {
      return data[0];
    });
  }
  , create : function(params) {
    return window.oauth_dfd.then(function() {

      var dfd = new $.Deferred();

      gapi.client.request({
        path : "/drive/v2/files"
        , method : "post"
        , body : {
          "mimeType": "application/vnd.google-apps.folder"
          , title : params.title
          , parents : params.parents.push ? params.parents : [params.parents]
        }
        , callback : function(result) {
          if(result.error) {
            dfd.reject(dfd, result.error.status, result.error);
          } else {
            dfd.resolve(result);
          }
        }
      });
      return dfd;
    });
  }
  , findChildFolders : function(params) {
    if(typeof params !== "string") {
      params = params.id;
    }
    return this.findAll({ parent : params.id });
  }
  , addChildFolder : function(parent, params) {
    return this.create($.extend({ parent : parent }, params));
  }
  , from_id : function(id) {
    return new this({ id : id });
  }
  , model : function(params) {
    if(params.url) {
      params.selfLink = "#";
    }
    return this._super.apply(this, arguments);
  }
}, {

  findChildFolders : function() {
    return this.constructor.findChildFolders(this);
  }

});

can.Model.Cacheable("CMS.Models.GDriveFilePermission", {

  //call findAll with id param.
  findAll : gdrive_findAll({}, "/permissions")

}, {});

CMS.Models.GDriveFilePermission("CMS.Models.GDriveFolderPermission", {}, {});

can.Model.Join("CMS.Models.ObjectFolder", {
  root_object : "object_folder"
  , root_collection : "object_folders"
  , findAll: "GET /api/object_folders?__include=folder"
  , create : "POST /api/object_folders"
  , update : "PUT /api/object_folders/{id}"
  , destroy : "DELETE /api/object_folders/{id}"
  , join_keys : {
    folderable : can.Model.Cacheable
    , folder : CMS.Models.GDriveFolder
  }
  , attributes : {
      modified_by : "CMS.Models.Person.stub"
    , folder : "CMS.Models.GDriveFolder.stub"
    , folderable : "CMS.Models.get_stub"
  }

  , model : function(params) {
    if(typeof params === "object") {
      params.folder = {
        id : params.folder_id
        , parentfolderid : params.parent_folder_id
      };
    }
    return this._super(params);
  }
}, {});

can.Model.Join("CMS.Models.ObjectFile", {
  root_object : "object_file"
  , root_collection : "object_files"
  , findAll: "GET /api/object_people?__include=person"
  , create : "POST /api/object_people"
  , update : "PUT /api/object_people/{id}"
  , destroy : "DELETE /api/object_people/{id}"
  , join_keys : {
    fileable : can.Model.Cacheable
    , file : CMS.Models.GDriveFile
  }
  , attributes : {
      modified_by : "CMS.Models.Person.stub"
    , file : "CMS.Models.GDriveFile.stub"
    , fileable : "CMS.Models.get_stub"
  }

  , model : function(params) {
    if(typeof params === "object") {
      params.folder = {
        id : params.file_id
        , parentfolderid : params.folder_id
      };
    }
    return this._super(params);
  }
}, {});

})(window.can);
