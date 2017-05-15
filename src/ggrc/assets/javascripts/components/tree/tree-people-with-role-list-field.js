/*!
  Copyright (C) 2017 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (can, GGRC) {
  'use strict';

  GGRC.Components('treePeopleWithRoleListField', {
    tag: 'tree-people-with-role-list-field',
    template: '<content />',
    viewModel: can.Map.extend({
      source: null,
      role: null,
      people: [],
      peopleStr: '',
      init: function () {
        this.refreshPeople();
      },
      refreshPeople: function () {
        this.getPeopleList()
          .then(function (data) {
            this.attr('people', data);
            this.attr('peopleStr', data.map(function (item) {
              return item.displayName;
            }).join(', '));
          }.bind(this));
      },
      getPeopleList: function () {
        var sourceList = this.getSourceList();
        var result;
        var deferred = can.Deferred();

        if (!sourceList.length) {
          return deferred.resolve([]);
        }

        this.loadItems(sourceList)
          .then(function (data) {
            result = data.map(function (item) {
              var shortEmail = item.email.replace(/@.*$/, '');
              var displayName = item.name || shortEmail;
              return {
                name: item.name,
                email: item.email,
                shortEmail: shortEmail,
                displayName: displayName
              };
            });
            deferred.resolve(result);
          })
          .fail(function () {
            deferred.resolve([]);
          });

        return deferred;
      },
      getSourceList: function () {
        var roleName = this.attr('role');
        var instance = this.attr('source');
        var peopleIds = GGRC.Utils.peopleWithRoleName(instance, roleName);

        return peopleIds;
      },
      loadItems: function (ids) {
        return CMS.Models.Person.findAll({id__in: ids.join(',')});
      }
    }),
    events: {
      '{viewModel} source': function () {
        this.viewModel.refreshPeople();
      }
    }
  });
})(window.can, window.GGRC);
