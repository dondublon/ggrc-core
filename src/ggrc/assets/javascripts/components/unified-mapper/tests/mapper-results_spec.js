/*!
  Copyright (C) 2017 Google Inc.
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

describe('GGRC.Components.mapperResults', function () {
  'use strict';

  var viewModel;

  beforeEach(function () {
    var Component = GGRC.Components.get('mapperResults');
    var init = Component.prototype.viewModel.init;
    Component.prototype.viewModel.init = undefined;
    viewModel = GGRC.Components.getViewModel('mapperResults');
    viewModel.attr('mapper', {
      type: 'Control'
    });
    viewModel.attr('submitCbs', $.Callbacks());
    viewModel.attr('paging',
      new GGRC.VM.Pagination({pageSizeSelect: [5, 10, 15]}));
    Component.prototype.viewModel.init = init;
    viewModel.init = init;
  });

  describe('init() method', function () {
    var displayPrefs = 'displayPrefs';

    beforeEach(function () {
      spyOn(CMS.Models.DisplayPrefs, 'getSingleton')
        .and.returnValue(can.Deferred().resolve(displayPrefs));
    });

    it('updates viewModel.displayPrefs', function () {
      viewModel.attr('displayPrefs', 'oldDisplayPrefs');
      viewModel.init();
      expect(viewModel.attr('displayPrefs'))
        .toEqual(displayPrefs);
    });
  });

  describe('destroy() method', function () {
    beforeEach(function () {
      spyOn(viewModel.attr('submitCbs'), 'remove');
    });

    it('removes function from viewModel.submitCbs', function () {
      viewModel.destroy();
      expect(viewModel.attr('submitCbs').remove)
        .toHaveBeenCalledWith(jasmine.any(Function));
    });
  });

  describe('searchOnly() method', function () {
    it('returns true if it is search only case', function () {
      var result;
      viewModel.attr('mapper', {
        search_only: true
      });
      result = viewModel.searchOnly();
      expect(result).toEqual(true);
    });
    it('returns false if it is not search-only case', function () {
      var result;
      viewModel.attr('mapper', {
        search_only: false
      });
      result = viewModel.searchOnly();
      expect(result).toEqual(false);
    });
  });

  describe('useSnapshots() method', function () {
    it('returns true if it is use-snapshots case', function () {
      var result;
      viewModel.attr('mapper', {
        useSnapshots: true
      });
      result = viewModel.useSnapshots();
      expect(result).toEqual(true);
    });
    it('returns false if it is not use-snapshots case', function () {
      var result;
      viewModel.attr('mapper', {
        useSnapshots: false
      });
      result = viewModel.useSnapshots();
      expect(result).toEqual(false);
    });
  });

  describe('showNewEntries() method', function () {
    beforeEach(function () {
      viewModel.attr('mapper', {});
    });

    it('updates viewModel.selected', function () {
      viewModel.attr('selected', []);
      viewModel.attr('mapper.newEntries', [
          {id: 'mockId', type: 'mockType'}
      ]);
      spyOn(viewModel, 'transformValue')
        .and.returnValue('mockData');
      viewModel.showNewEntries();
      expect(viewModel.attr('selected').length)
        .toEqual(1);
      expect(viewModel.attr('selected')[0])
        .toEqual(jasmine.objectContaining({
          id: 'mockId',
          type: 'mockType',
          data: 'mockData',
          isSelected: true,
          markedSelected: true
        }));
    });

    it('clears filter', function () {
      viewModel.showNewEntries();
      expect(viewModel.attr('filter')).toEqual('');
    });

    it('updates viewModel.prevSelected', function () {
      viewModel.attr('prevSelected', []);
      viewModel.attr('mapper.newEntries', [
          {id: 'mockId', type: 'mockType'}
      ]);
      spyOn(viewModel, 'transformValue')
        .and.returnValue('mockData');
      viewModel.showNewEntries();
      expect(viewModel.attr('prevSelected').length)
        .toEqual(1);
      expect(viewModel.attr('prevSelected')[0])
        .toEqual(jasmine.objectContaining({
          id: 'mockId',
          type: 'mockType',
          data: 'mockData',
          isSelected: true,
          markedSelected: true
        }));
    });

    it('calls viewModel.onSearch() ', function () {
      viewModel.attr('sort.key', 'updated_at');
      viewModel.attr('sort.direction', 'desc');
      spyOn(viewModel, 'onSearch');
      viewModel.showNewEntries();
      expect(viewModel.onSearch).toHaveBeenCalled();
    });

    it('updates sort.key and sort.direction in viewModel', function () {
      viewModel.attr('sort.key', 'mockKey');
      viewModel.attr('sort.direcion', 'mockDirection');
      viewModel.showNewEntries();
      expect(viewModel.attr('sort.key')).toEqual('updated_at');
      expect(viewModel.attr('sort.direction')).toEqual('desc');
    });

    it('sets current page to 1', function () {
      viewModel.attr('paging.count', 10);
      viewModel.attr('paging.current', 9);
      viewModel.showNewEntries();
      expect(viewModel.attr('paging.current')).toEqual(1);
    });

    it('sets mapper.afterSearch to true', function () {
      viewModel.attr('mapper.afterSearch', false);
      viewModel.showNewEntries();
      expect(viewModel.attr('mapper.afterSearch')).toEqual(true);
    });
  });

  describe('setItems() method', function () {
    var items;

    beforeEach(function () {
      items = [
        {data: 'mockData'}
      ];
      spyOn(viewModel, 'load')
        .and.returnValue($.Deferred().resolve(items));
      spyOn(viewModel, 'setColumnsConfiguration');
      spyOn(viewModel, 'setRelatedAssessments');
      viewModel.attr('mapper', {});
    });

    it('sets loaded items to viewModel.items', function () {
      viewModel.attr('items', []);
      viewModel.setItems();
      expect(viewModel.attr('items').length).toEqual(1);
      expect(viewModel.attr('items')[0])
        .toEqual(jasmine.objectContaining({
          data: 'mockData'
        }));
    });

    it('sets data of loaded items to viewModel.mapper.entries', function () {
      viewModel.attr('mapper.entries', []);
      viewModel.setItems();
      expect(viewModel.attr('mapper.entries').length).toEqual(1);
      expect(viewModel.attr('mapper.entries')[0])
        .toEqual('mockData');
    });

    it('calls setColumnsConfiguration and setRelatedAssessments',
      function () {
        viewModel.setItems();
        expect(viewModel.setColumnsConfiguration).toHaveBeenCalled();
        expect(viewModel.setRelatedAssessments).toHaveBeenCalled();
      });

    it('sets viewModel.isBeforeLoad to false', function () {
      viewModel.attr('isBeforeLoad', true);
      viewModel.setItems();
      expect(viewModel.attr('isBeforeLoad')).toEqual(false);
    });
  });

  describe('setColumnsConfiguration() method', function () {
    var mockColumns;

    beforeEach(function () {
      viewModel.attr('columns', {});
      mockColumns = {
        available: 'mock1',
        selected: 'mock2',
        disableConfiguration: 'mock3'
      };
      spyOn(GGRC.Utils.TreeView, 'getColumnsForModel')
        .and.returnValue(mockColumns);
      spyOn(viewModel, 'getDisplayModel')
        .and.returnValue({
          model_singular: ''
        });
    });

    it('updates available columns', function () {
      viewModel.attr('columns.available', 'available');
      viewModel.setColumnsConfiguration();
      expect(viewModel.attr('columns.available')).toEqual('mock1');
    });

    it('updates selected columns', function () {
      viewModel.attr('columns.selected', 'selected');
      viewModel.setColumnsConfiguration();
      expect(viewModel.attr('columns.selected')).toEqual('mock2');
    });

    it('updates disableColumnsConfiguration', function () {
      viewModel.attr('disableColumnsConfiguration', 'configuration');
      viewModel.setColumnsConfiguration();
      expect(viewModel.attr('disableColumnsConfiguration')).toEqual('mock3');
    });
  });

  describe('setRelatedAssessments() method', function () {
    beforeEach(function () {
      viewModel.attr('mapper', {});
      viewModel.attr('relatedAssessments', {});
      spyOn(viewModel, 'getDisplayModel')
        .and.returnValue({
          tree_view_options: {
            show_related_assessments: true
          }
        });
    });

    it('sets relatedAssessments.show to false if it is use-snapshots case',
      function () {
        viewModel.attr('mapper.useSnapshots', true);
        viewModel.setRelatedAssessments();
        expect(viewModel.attr('relatedAssessments.show')).toEqual(false);
      });

    it('updates relatedAssessments.show if it is not use-snapshots case',
      function () {
        viewModel.attr('mapper.useSnapshots', false);
        viewModel.setRelatedAssessments();
        expect(viewModel.attr('relatedAssessments.show')).toEqual(true);
      });
  });

  describe('resetSearchParams() method', function () {
    var DEFAULT_PAGE_SIZE = 5;
    var DEFAULT_SORT_DIRECTION = 'asc';

    beforeEach(function () {
      viewModel.attr('paging', {});
      viewModel.attr('sort', {});
    });

    it('sets 1 to current of paging', function () {
      viewModel.attr('paging.current', 9);
      viewModel.resetSearchParams();
      expect(viewModel.attr('paging.current')).toEqual(1);
    });

    it('sets default size to pageSize of paging', function () {
      viewModel.attr('paging.pageSize', 11);
      viewModel.resetSearchParams();
      expect(viewModel.attr('paging.pageSize')).toEqual(DEFAULT_PAGE_SIZE);
    });

    it('sets empty string to key of sort', function () {
      viewModel.attr('sort.key', 'mockKey');
      viewModel.resetSearchParams();
      expect(viewModel.attr('sort.key')).toEqual('');
    });

    it('sets default sort direction to direction of sort', function () {
      viewModel.attr('sort.direction', 'across:)');
      viewModel.resetSearchParams();
      expect(viewModel.attr('sort.direction')).toEqual(DEFAULT_SORT_DIRECTION);
    });
  });

  describe('onSearch() method', function () {
    beforeEach(function () {
      spyOn(viewModel, 'resetSearchParams');
    });

    it('calls resetSearchParams() if resetParams defined', function () {
      viewModel.onSearch({});
      expect(viewModel.resetSearchParams).toHaveBeenCalled();
    });

    it('sets viewModel.refreshItems to true', function () {
      viewModel.attr('refreshItems', false);
      viewModel.onSearch();
      expect(viewModel.attr('refreshItems')).toEqual(true);
    });
  });

  describe('prepareRelevantFilters() method', function () {
    var relevantList = [{
      model_name: 'mockName'
    }, {
      model_name: 'mockName',
      textValue: 'text'
    }, {
      value: 'mockValue',
      filter: {
        type: 'mockType',
        id: 123
      }
    }];
    var expectedResult = [{
      type: 'mockName',
      operation: 'relevant',
      id: 0
    }, {
      type: 'mockType',
      operation: 'relevant',
      id: 123
    }];
    beforeEach(function () {
      viewModel.attr('mapper.relevant', relevantList);
    });
    it('returns relevant filters from mapper', function () {
      var result = viewModel.prepareRelevantFilters();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('prepareBaseQuery() method', function () {
    beforeEach(function () {
      spyOn(GGRC.Utils.QueryAPI, 'buildParam').and.returnValue('mockQuery');
    });

    it('calls GGRC.Utils.QueryAPI.buildParam()',
      function () {
        var result = viewModel.prepareBaseQuery(
          'modelName', 'paging', 'filters', 'statusFilter');
        expect(result).toEqual('mockQuery');
      });
  });

  describe('prepareRelatedQuery() method', function () {
    it('returns null if viewModel.baseInstance is undefined', function () {
      var result = viewModel.prepareRelatedQuery();
      expect(result).toEqual(null);
    });

    it('returns query', function () {
      var result;
      viewModel.attr('baseInstance', {
        type: 'mockType',
        id: 123
      });
      spyOn(GGRC.Utils.QueryAPI, 'buildRelevantIdsQuery')
        .and.returnValue('mockQuery');
      result = viewModel.prepareRelatedQuery('modelName', 'statusFilter');
      expect(result).toEqual('mockQuery');
    });
  });

  describe('prepareStatusFilter() method', function () {
    it('returns null if viewModel.statusFilter is undefined', function () {
      var result = viewModel.prepareStatusFilter();
      expect(result).toEqual(null);
    });

    it('returns query', function () {
      var result;
      viewModel.attr('statusFilter', 'mockFilter');
      spyOn(GGRC.query_parser, 'parse')
        .and.returnValue('mockQuery');
      result = viewModel.prepareStatusFilter();
      expect(result).toEqual('mockQuery');
    });
  });

  describe('loadAllItems() method', function () {
    beforeEach(function () {
      spyOn(viewModel, 'loadAllItemsIds')
        .and.returnValue('mockItems');
    });

    it('updates viewModel.allItems', function () {
      viewModel.loadAllItems();
      expect(viewModel.attr('allItems')).toEqual('mockItems');
    });
  });

  describe('getQuery() method', function () {
    var mockPaging = {
      current: 'mock1',
      pageSize: 'mock2'
    };
    var mockSort = {
      key: 'mock3',
      direction: 'mock4'
    };
    beforeEach(function () {
      viewModel.attr('type', 'mockName');
      viewModel.attr('paging', mockPaging);
      viewModel.attr('sort', mockSort);
      viewModel.attr('filter', 'mockFilter');

      spyOn(viewModel, 'prepareRelevantFilters')
        .and.returnValue('filters');
      spyOn(viewModel, 'prepareStatusFilter')
        .and.returnValue('statusFilter');
      spyOn(viewModel, 'prepareRelatedQuery')
        .and.returnValue({mockData: 'related'});

      it('returns query', function () {
        var result;
        spyOn(viewModel, 'useSnapshots')
          .and.returnValue(false);
        spyOn(viewModel, 'prepareBaseQuery')
          .and.returnValue({mockData: 'base'});
        result = viewModel.getQuery();
        expect(result.data[0]).toEqual(jasmine.objectContaining({
          mockData: 'base',
          permissions: 'update',
          type: 'values'
        }));
        expect(result.data[1]).toEqual(jasmine.objectContaining({
          mockData: 'related'
        }));
      });

      it('adds paging to query if addPaging is true', function () {
        var result;
        var paging;
        spyOn(viewModel, 'useSnapshots')
          .and.returnValue(false);
        spyOn(viewModel, 'prepareBaseQuery')
          .and.returnValue({mockData: 'basePaging'});
        result = viewModel.getQuery(undefined, true);
        paging = jasmine.objectContaining(mockPaging);
        expect(viewModel.prepareBaseQuery)
          .toHaveBeenCalledWith('mockName', paging, 'filters', 'statusFilter');
        expect(result.data[0]).toEqual(jasmine.objectContaining({
          mockData: 'basePging',
          permissions: 'update',
          type: 'values'
        }));
        expect(result.data[1]).toEqual(jasmine.objectContaining({
          mockData: 'related'
        }));
      });
    });

    it('adds paging with sort to query if sort.key is defined', function () {
      var result;
      var paging;
      spyOn(viewModel, 'useSnapshots')
        .and.returnValue(false);
      spyOn(viewModel, 'prepareBaseQuery')
        .and.returnValue({mockData: 'basePagingSort'});
      result = viewModel.getQuery(undefined, true);
      paging = jasmine.objectContaining(mockPaging, mockSort);
      expect(viewModel.prepareBaseQuery)
        .toHaveBeenCalledWith('mockName', paging, 'filters', 'statusFilter');
      expect(result.data[0]).toEqual(jasmine.objectContaining({
        mockData: 'basePagingSort',
        permissions: 'update',
        type: 'values'
      }));
      expect(result.data[1]).toEqual(jasmine.objectContaining({
        mockData: 'related'
      }));
    });

    it('sets "read" to permissions if model is person', function () {
      var result;
      viewModel.attr('type', 'Person');
      spyOn(viewModel, 'useSnapshots')
        .and.returnValue(false);
      spyOn(viewModel, 'prepareBaseQuery')
        .and.returnValue({mockData: 'basePagingSort'});
      result = viewModel.getQuery('Person', true);
      expect(result.data[0]).toEqual(jasmine.objectContaining({
        mockData: 'basePagingSort',
        permissions: 'read',
        type: 'Person'
      }));
    });

    it('transform query to snapshot if useSnapshots is true', function () {
      var result;
      spyOn(viewModel, 'useSnapshots')
        .and.returnValue(true);
      spyOn(viewModel, 'prepareBaseQuery')
        .and.returnValue({mockData: 'base'});
      spyOn(GGRC.Utils.Snapshots, 'transformQuery')
        .and.returnValue({mockData: 'snapshot'});
      result = viewModel.getQuery();
      expect(result.data[0]).toEqual(jasmine.objectContaining({
        mockData: 'snapshot',
        permissions: 'update',
        type: 'values'
      }));
      expect(result.data[1]).toEqual(jasmine.objectContaining({
        mockData: 'snapshot'
      }));
    });
  });

  describe('getModelKey() method', function () {
    it('returns "Snapshot" if useSnapshots is true', function () {
      var result;
      spyOn(viewModel, 'useSnapshots')
        .and.returnValue(true);
      result = viewModel.getModelKey();
      expect(result).toEqual('Snapshot');
    });

    it('returns type of model if useSnapshots is false', function () {
      var result;
      viewModel.attr('type', 'Mock');
      spyOn(viewModel, 'useSnapshots')
        .and.returnValue(false);
      result = viewModel.getModelKey();
      expect(result).toEqual('Mock');
    });
  });

  describe('getModel() method', function () {
    it('returns model', function () {
      var result;
      spyOn(viewModel, 'getModelKey')
        .and.returnValue('Program');
      result = viewModel.getModel();
      expect(result).toEqual(CMS.Models.Program);
    });
  });

  describe('getDisplayModel() method', function () {
    it('returns displayModel', function () {
      var result;
      viewModel.attr('type', 'Program');
      result = viewModel.getDisplayModel();
      expect(result).toEqual(CMS.Models.Program);
    });
  });

  describe('setDisabledItems() method', function () {
    var allItems = [{
      data: {
        id: 123
      }
    }, {
      data: {
        id: 124
      }
    }];
    var relatedIds = [123];
    var expectedResult = [{
      data: {
        id: 123
      },
      isDisabled: true
    }, {
      data: {
        id: 124
      },
      isDisabled: false
    }];

    it('does nothing if viewModel.searchOnly() is true', function () {
      spyOn(viewModel, 'searchOnly')
        .and.returnValue(true);
      viewModel.setDisabledItems(allItems, relatedIds);
      expect(allItems).toEqual(allItems);
    });

    it('does nothing if it is case of assesment generation',
      function () {
        viewModel.attr('mapper', {
          assessmentGenerator: {}
        });
        viewModel.setDisabledItems(allItems, relatedIds);
        expect(allItems).toEqual(allItems);
      });

    it('updates disabled items', function () {
      spyOn(viewModel, 'searchOnly')
        .and.returnValue(false);
      viewModel.setDisabledItems(allItems, relatedIds);
      expect(allItems).toEqual(expectedResult);
    });
  });

  describe('setSelectedItems() method', function () {
    var allItems = [{
      id: 123
    }, {
      id: 124
    }];
    var expectedResult = [{
      id: 123,
      isSelected: true,
      markedSelected: true
    }, {
      id: 124,
      isSelected: false
    }];

    it('updates selected items', function () {
      viewModel.attr('selected', [{id: 123}]);
      viewModel.setSelectedItems(allItems);
      expect(allItems).toEqual(expectedResult);
    });

    it('uses prevSelected if prevSelected.length > 0', function () {
      viewModel.attr('prevSelected', [{id: 123}]);
      viewModel.setSelectedItems(allItems);
      expect(allItems).toEqual(expectedResult);
      expect(viewModel.attr('prevSelected').length).toEqual(0);
    });
  });

  describe('transformValue() method', function () {
    var Model;

    beforeEach(function () {
      Model = {
        model: jasmine.createSpy().and.returnValue('transformedValue')
      };
      spyOn(viewModel, 'getDisplayModel')
        .and.returnValue(Model);
    });

    it('returns transformed value', function () {
      var result;
      var value = 'mockValue';
      spyOn(viewModel, 'useSnapshots')
        .and.returnValue(false);
      result = viewModel.transformValue(value);
      expect(result).toEqual('transformedValue');
    });

    it('returns snapshot-transformed value if it is use-snapshots case',
      function () {
        var result;
        var value = {
          revision: {
            content: 'mockContent'
          }
        };
        var expectedResult = {
          snapshotObject: 'snapshot',
          revision: {
            content: 'transformedValue'
          }
        };
        spyOn(GGRC.Utils.Snapshots, 'toObject')
          .and.returnValue('snapshot');
        spyOn(viewModel, 'useSnapshots')
          .and.returnValue(true);
        result = viewModel.transformValue(value);
        expect(result).toEqual(expectedResult);
      });
  });

  describe('load() method', function () {
    var data = {
      program: {
        values: [{
          id: 123,
          type: 'mockType'
        }],
        total: 4
      }
    };
    var expectedResult = [{
      id: 123,
      type: 'mockType',
      data: 'transformedValue'
    }];
    var relatedData;
    var dfdRequest;
    var resultDfd;

    beforeEach(function () {
      spyOn(viewModel, 'getModelKey')
        .and.returnValue('program');
      spyOn(viewModel, 'getQuery')
        .and.returnValue('query');
      spyOn(viewModel, 'transformValue')
        .and.returnValue('transformedValue');
      spyOn(viewModel, 'setSelectedItems');
      spyOn(viewModel, 'setDisabledItems');
      dfdRequest = $.Deferred();
      spyOn(GGRC.Utils.QueryAPI, 'makeRequest')
        .and.returnValue(dfdRequest.promise());
    });

    it('calls viewModel.setSelectedItems()', function () {
      var responseArr = [data, relatedData];
      dfdRequest.resolve(responseArr);
      viewModel.load();
      expect(viewModel.setSelectedItems)
        .toHaveBeenCalledWith(expectedResult);
    });

    it('calls viewModel.setDisabledItems() if relatedData is defined',
      function () {
        var responseArr;
        relatedData = {
          program: {
            ids: 'ids'
          }
        };
        responseArr = [data, relatedData];
        dfdRequest.resolve(responseArr);
        viewModel.load();
        expect(viewModel.setDisabledItems)
          .toHaveBeenCalledWith(expectedResult, 'ids');
      });

    it('updates paging', function () {
      var responseArr = [data, relatedData];
      dfdRequest.resolve(responseArr);
      viewModel.load();
      expect(viewModel.attr('paging.total')).toEqual(4);
    });

    it('sets isLoading to false', function () {
      var responseArr = [data, relatedData];
      dfdRequest.resolve(responseArr);
      viewModel.load();
      expect(viewModel.attr('isLoading')).toEqual(false);
    });

    it('returns promise with array of items', function (done) {
      var responseArr = [data, relatedData];
      dfdRequest.resolve(responseArr);
      resultDfd = viewModel.load();
      expect(resultDfd.state()).toEqual('resolved');
      resultDfd.then(function (result) {
        expect(result).toEqual(expectedResult);
        done();
      });
    });

    it('returns promise with empty array if fail', function (done) {
      dfdRequest.reject();
      resultDfd = viewModel.load();
      expect(resultDfd.state()).toEqual('resolved');
      resultDfd.then(function (result) {
        expect(result).toEqual([]);
        done();
      });
    });
  });

  describe('loadAllItemsIds() method', function () {
    var data = {
      program: {
        ids: [123]
      }
    };
    var expectedResult = [{
      id: 123,
      type: 'program'
    }];
    var filters = {
      program: {
        ids: [123]
      }
    };
    var resultDfd;
    var dfdRequest;

    beforeEach(function () {
      viewModel.attr('mapper', {});
      dfdRequest = can.Deferred();
      spyOn(GGRC.Utils.QueryAPI, 'makeRequest')
        .and.returnValue(dfdRequest.promise());
      spyOn(viewModel, 'getModelKey')
        .and.returnValue('program');
      spyOn(viewModel, 'getQuery')
        .and.returnValue('query');
      spyOn(viewModel, 'transformValue')
        .and.returnValue('transformedValue');
    });

    it('rerturns promise with items', function (done) {
      var responseArr = [data, filters];
      dfdRequest.resolve(responseArr);
      viewModel.attr('mapper.assessmentGenerator', true);
      resultDfd = viewModel.loadAllItemsIds();
      expect(resultDfd.state()).toEqual('resolved');
      resultDfd.then(function (result) {
        expect(result).toEqual(expectedResult);
        done();
      });
    });

    it('performs extra mapping validation in case Assessment generation',
      function (done) {
        var responseArr = [data, filters];
        dfdRequest.resolve(responseArr);
        viewModel.attr('mapper.assessmentGenerator', false);
        resultDfd = viewModel.loadAllItemsIds();
        expect(resultDfd.state()).toEqual('resolved');
        resultDfd.then(function (result) {
          expect(result).toEqual([]);
          done();
        });
      });

    it('rerturns promise with empty array if fail',
      function (done) {
        dfdRequest.reject();
        viewModel.attr('mapper.assessmentGenerator', true);
        resultDfd = viewModel.loadAllItemsIds();
        expect(resultDfd.state()).toEqual('resolved');
        resultDfd.then(function (result) {
          expect(result).toEqual([]);
          done();
        });
      });
  });

  describe('setItemsDebounced() method', function () {
    beforeEach(function () {
      spyOn(window, 'clearTimeout');
      spyOn(window, 'setTimeout')
        .and.returnValue(123);
    });

    it('clears timeout of viewModel._setItemsTimeout', function () {
      viewModel.attr('_setItemsTimeout', 321);
      viewModel.setItemsDebounced();
      expect(clearTimeout).toHaveBeenCalledWith(321);
    });

    it('sets timeout in viewModel._setItemsTimeout', function () {
      viewModel.setItemsDebounced();
      expect(viewModel.attr('_setItemsTimeout'))
        .toEqual(123);
    });
  });

  describe('showRelatedAssessments() method', function () {
    beforeEach(function () {
      viewModel.attr('relatedAssessments', {
        state: {}
      });
    });

    it('sets viewModel.relatedAssessments.instance', function () {
      viewModel.attr('relatedAssessments.instance', 1);
      viewModel.showRelatedAssessments({
        instance: 123
      });
      expect(viewModel.attr('relatedAssessments.instance'))
        .toEqual(123);
    });

    it('sets viewModel.relatedAssessments.state.open to true', function () {
      viewModel.attr('relatedAssessments.state.open', false);
      viewModel.showRelatedAssessments({
        instance: 123
      });
      expect(viewModel.attr('relatedAssessments.state.open'))
        .toEqual(true);
    });
  });

  describe('events', function () {
    var events;

    beforeEach(function () {
      var Component = GGRC.Components.get('mapperResults');
      events = Component.prototype.events;
    });

    describe('"{viewModel} allSelected" event', function () {
      var handler;

      beforeEach(function () {
        spyOn(viewModel, 'loadAllItems');
        handler = events['{viewModel} allSelected'].bind({
          viewModel: viewModel
        });
      });
      it('calls loadAllItems() if allSelected is truly', function () {
        handler({}, {}, true);
        expect(viewModel.loadAllItems).toHaveBeenCalled();
      });
      it('does not call loadAllItems() if allSelected is falsy', function () {
        handler({}, {}, false);
        expect(viewModel.loadAllItems).not.toHaveBeenCalled();
      });
    });

    describe('"{viewModel} refreshItems" event', function () {
      var handler;

      beforeEach(function () {
        spyOn(viewModel, 'setItemsDebounced');
        handler = events['{viewModel} refreshItems'].bind({
          viewModel: viewModel
        });
      });
      it('calls setItemsDebounced() if refreshItems is truly', function () {
        handler({}, {}, true);
        expect(viewModel.setItemsDebounced).toHaveBeenCalled();
      });
      it('sets false to viewModel.refreshItems if refreshItems is truly',
        function () {
          handler({}, {}, true);
          expect(viewModel.setItemsDebounced).toHaveBeenCalled();
        });
      it('does not call setItemsDebounced() if refreshItems is falsy',
        function () {
          handler({}, {}, false);
          expect(viewModel.setItemsDebounced).not.toHaveBeenCalled();
        });
    });

    describe('"{viewModel.paging} current" event', function () {
      var handler;

      beforeEach(function () {
        spyOn(viewModel, 'setItemsDebounced');
        handler = events['{viewModel.paging} current'].bind({
          viewModel: viewModel
        });
      });
      it('calls setItemsDebounced()', function () {
        handler();
        expect(viewModel.setItemsDebounced).toHaveBeenCalled();
      });
    });

    describe('"{viewModel.paging} pageSize" event', function () {
      var handler;

      beforeEach(function () {
        spyOn(viewModel, 'setItemsDebounced');
        handler = events['{viewModel.paging} pageSize'].bind({
          viewModel: viewModel
        });
      });
      it('calls setItemsDebounced()', function () {
        handler();
        expect(viewModel.setItemsDebounced).toHaveBeenCalled();
      });
    });

    describe('"{viewModel.sort} key" event', function () {
      var handler;

      beforeEach(function () {
        spyOn(viewModel, 'setItemsDebounced');
        handler = events['{viewModel.sort} key'].bind({
          viewModel: viewModel
        });
      });
      it('calls setItemsDebounced()', function () {
        handler();
        expect(viewModel.setItemsDebounced).toHaveBeenCalled();
      });
    });

    describe('"{viewModel.sort} direction" event', function () {
      var handler;

      beforeEach(function () {
        spyOn(viewModel, 'setItemsDebounced');
        handler = events['{viewModel.sort} direction'].bind({
          viewModel: viewModel
        });
      });
      it('calls setItemsDebounced()', function () {
        handler();
        expect(viewModel.setItemsDebounced).toHaveBeenCalled();
      });
    });

    describe('"{viewModel} type" event', function () {
      var handler;

      beforeEach(function () {
        handler = events['{viewModel} type'].bind({
          viewModel: viewModel
        });
      });
      it('sets empty array to items of viewModel', function () {
        viewModel.attr('items', [1, 2, 3]);
        handler();
        expect(viewModel.attr('items').length).toEqual(0);
      });
    });
  });

  describe('buildRelatedData() method', function () {
    var viewModel;

    beforeEach(function () {
      var Component = GGRC.Components.get('mapperResults');
      Component.prototype.viewModel.init = undefined;
      viewModel = GGRC.Components.getViewModel('mapperResults');
      viewModel.attr('mapper', {});
    });

    it('method should return data from "relatedData" array',
      function () {
        var relatedData = {
          Snapshot: {
            ids: [1, 2, 3]
          }
        };

        var result = viewModel
          .buildRelatedData(relatedData, 'Snapshot');
        expect(result.Snapshot.ids.length).toEqual(3);
        expect(result.Snapshot.ids[0]).toEqual(1);
      }
    );

    it('method should return data from "deferred_list" array',
      function () {
        var relatedData = {
          Snapshot: {
            ids: [1, 2, 3]
          }
        };
        var result;

        viewModel.attr('mapper.deferred_list', [
          {id: 5, type: 'Snapshot'},
          {id: 25, type: 'Snapshot'}
        ]);

        result = viewModel
          .buildRelatedData(relatedData, 'Snapshot');
        expect(result.Snapshot.ids.length).toEqual(2);
        expect(result.Snapshot.ids[0]).toEqual(5);
      }
    );

    it('return data from "deferred_list" array. RelatedData is undefined',
      function () {
        var result;

        viewModel.attr('mapper.deferred_list', [
          {id: 5, type: 'Snapshot'},
          {id: 25, type: 'Snapshot'}
        ]);

        result = viewModel
          .buildRelatedData(undefined, 'Snapshot');
        expect(result.Snapshot.ids.length).toEqual(2);
        expect(result.Snapshot.ids[0]).toEqual(5);
      }
    );
  });
});
