/*!
  Copyright (C) 2017 Google Inc.
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

describe('CMS.Models.Assessment', function () {
  'use strict';

  describe('before_create() method', function () {
    var assessment;
    var audit;
    var auditWithoutContext;
    var context;
    var program;

    beforeEach(function () {
      assessment = new CMS.Models.Assessment();
      context = new CMS.Models.Context({id: 42});
      program = new CMS.Models.Program({id: 54});
      audit = new CMS.Models.Audit({context: context, program: program});
      auditWithoutContext = new CMS.Models.Audit({program: program});
    });

    it('sets the program and context properties', function () {
      assessment.attr('audit', audit);
      assessment.before_create();
      expect(assessment.context.id).toEqual(context.id);
    });

    it('throws an error if audit is not defined', function () {
      expect(function () {
        assessment.before_create();
      }).toThrow(new Error('Cannot save assessment, audit not set.'));
    });

    it('throws an error if audit program/context are not defined', function () {
      assessment.attr('audit', auditWithoutContext);
      expect(function () {
        assessment.before_create();
      }).toThrow(new Error(
        'Cannot save assessment, audit context not set.'));
    });
    it('sets empty string to design property', function () {
      assessment.attr('audit', audit);
      assessment.attr('design', undefined);
      assessment.before_create();
      expect(assessment.attr('design')).toEqual('');
    });
    it('sets empty string to operationally property', function () {
      assessment.attr('audit', audit);
      assessment.attr('operationally', undefined);
      assessment.before_create();
      expect(assessment.attr('operationally')).toEqual('');
    });
  });

  describe('_transformBackupProperty() method', function () {
    var assessment;

    beforeEach(function () {
      assessment = new CMS.Models.Assessment();
    });
    it('does nothing if no backup of instance', function () {
      assessment.attr('name', '');
      assessment._transformBackupProperty(['name']);
      expect(assessment.attr('name')).toEqual('');
    });
    it('transforms backups property if it is falsy in instance and in backup' +
    'but not equal', function () {
      assessment.attr('name', '');
      assessment.backup();
      assessment._backupStore().name = null;
      assessment._transformBackupProperty(['name']);
      expect(assessment._backupStore().name).toEqual('');
    });
    it('updates validate_assessor in backup if it is define in instance',
      function () {
        assessment.backup();
        assessment.attr('validate_assessor', true);
        assessment._backupStore().validate_assessor = undefined;
        assessment._transformBackupProperty(['name']);
        expect(assessment._backupStore().validate_assessor).toEqual(true);
      });
    it('updates validate_creator in backup if it is define in instance',
      function () {
        assessment.backup();
        assessment.attr('validate_creator', true);
        assessment._backupStore().validate_creator = undefined;
        assessment._transformBackupProperty(['name']);
        expect(assessment._backupStore().validate_creator).toEqual(true);
      });
  });
  describe('isDirty() method', function () {
    var assessment;

    beforeEach(function () {
      assessment = new CMS.Models.Assessment();
      spyOn(assessment, '_transformBackupProperty')
        .and.callThrough();
    });
    it('calls _transformBackupProperty() with specified arguments',
      function () {
        assessment.isDirty();
        expect(assessment._transformBackupProperty)
          .toHaveBeenCalledWith(['design', 'operationally', '_disabled']);
      });
    it('returns result of inherited function, true if instance is dirty',
      function () {
        var result;
        assessment.attr('name', 'assessment1');
        assessment.backup();
        assessment.attr('name', 'assessment1.1');
        result = assessment.isDirty();
        expect(result).toEqual(true);
      });
    it('returns result of inherited function, false if instance is not dirty',
      function () {
        var result;
        assessment.attr('name', 'assessment1');
        assessment.backup();
        result = assessment.isDirty();
        expect(result).toEqual(false);
      });
  });

  describe('leaveUniqueAssignees() method', function () {
    var assessment;
    var method;

    beforeAll(function () {
      method = CMS.Models.Assessment.leaveUniqueAssignees;
    });

    beforeEach(function () {
      assessment = new can.Map({id: 123, title: 'asmt 123'});
    });

    it('creates assignees object on an instance that lacks one', function () {
      var actual;

      var attributes = new can.Map({
        assignees: {
          Creator: [{id: 5, email: 'john@doe.com'}]
        }
      });

      assessment.attr('assignees', undefined);

      method(assessment, attributes, 'Creator');

      actual = assessment.attr('assignees.Creator');
      expect(actual).toBeDefined();
      expect(actual.length).toBe(1);
      expect(actual[0].attr()).toEqual({id: 5, email: 'john@doe.com'});
    });
  });
});
