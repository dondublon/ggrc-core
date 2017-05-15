/*!
  Copyright (C) 2017 Google Inc.
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

describe('GGRC.Utils.TreeView module', function () {
  'use strict';

  var method;
  var module;
  var origPageType;

  beforeAll(function () {
    module = GGRC.Utils.TreeView;

    origPageType = GGRC.pageType;
    GGRC.pageType = 'MY_WORK';
  });

  afterAll(function () {
    GGRC.pageType = origPageType;
  });

  describe('getColumnsForModel() method', function () {
    var origCustomAttrDefs;
    var origRoleList;
    var origAttrs;

    beforeAll(function () {
      method = module.getColumnsForModel;

      origRoleList = GGRC.access_control_roles;
      origAttrs = [].concat(CMS.Models.CycleTaskGroupObjectTask
        .tree_view_options.display_attr_names);
      GGRC.access_control_roles = [
        {id: 5, name: 'Role 5', object_type: 'Market'},
        {id: 9, name: 'Role 9', object_type: 'Audit'},
        {id: 1, name: 'Role 1', object_type: 'Market'},
        {id: 7, name: 'Role 7', object_type: 'Policy'},
        {id: 3, name: 'Role 3', object_type: 'Audit'},
        {id: 2, name: 'Role 2', object_type: 'Policy'}
      ];

      origCustomAttrDefs = GGRC.custom_attr_defs;
      GGRC.custom_attr_defs = [{
        id: 16, attribute_type: 'Text',
        definition_type: 'market', title: 'CA def 16'
      }, {
        id: 5, attribute_type: 'Text',
        definition_type: 'policy', title: 'CA def 5'
      }, {
        id: 11, attribute_type: 'Text',
        definition_type: 'audit', title: 'CA def 11'
      }];
    });

    afterAll(function () {
      GGRC.access_control_roles = origRoleList;
      GGRC.custom_attr_defs = origCustomAttrDefs;
      CMS.Models.CycleTaskGroupObjectTask
        .tree_view_options.display_attr_names =
          origAttrs;
    });

    it('includes custom roles info in the result ', function () {
      var result = method('Audit', null);
      result = _.filter(result.available, {attr_type: 'role'});

      ['Role 3', 'Role 9'].forEach(function (title) {
        var expected = {
          attr_type: 'role',
          attr_title: 'Role 9',
          attr_name: 'Role 9',
          attr_sort_field: 'Role 9'
        };
        expect(result).toContain(jasmine.objectContaining(expected));
      });
    });

    it('adds to selected columns "end_date" ' +
    'if modelType is CycleTaskGroupObjectTask and current page is MyWork',
    function () {
      var result;
      var modelType = 'CycleTaskGroupObjectTask';
      GGRC.pageType = 'MY_WORK';
      CMS.Models[modelType].tree_view_options.display_attr_names =
        ['title', 'assignee', 'start_date'];

      result = method(modelType, null);
      expect(result.selected).toContain(jasmine.objectContaining({
        attr_name: 'end_date'
      }));
    });

    it('does not add to selected columns "end_date" ' +
    'if it is CycleTaskGroupObjectTask but current page is not MyWork',
    function () {
      var result;
      var modelType = 'CycleTaskGroupObjectTask';
      GGRC.pageType = 'Person';
      CMS.Models[modelType].tree_view_options.display_attr_names =
        ['title', 'assignee', 'start_date'];

      result = method(modelType, null);
      expect(result.selected).not.toContain(jasmine.objectContaining({
        attr_name: 'end_date'
      }));
    });
  });
});
