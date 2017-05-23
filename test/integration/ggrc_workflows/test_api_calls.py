# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

import unittest

from ggrc_workflows.models import TaskGroup
from ggrc_workflows.models import Workflow
# for cycle task test:
from ggrc_workflows.models import Cycle

from integration.ggrc import TestCase
from integration.ggrc.api_helper import Api
import pdb
from integration.ggrc_workflows.workflow_cycle_calculator.base_workflow_test_case import BaseWorkflowTestCase


class TestWorkflowsApiPost(BaseWorkflowTestCase):

  def setUp(self):
    super(TestWorkflowsApiPost, self).setUp()
    self.api = Api()

  def tearDown(self):
    pass

  def test_send_invalid_data(self):
    data = self.get_workflow_dict()
    del data["workflow"]["title"]
    del data["workflow"]["context"]
    response = self.api.post(Workflow, data)
    self.assert400(response)

  def test_create_one_time_workflows(self):
    data = self.get_workflow_dict()
    response = self.api.post(Workflow, data)
    self.assertEqual(response.status_code, 201)

  def test_create_weekly_workflows(self):
    data = self.get_workflow_dict()
    data["workflow"]["frequency"] = "weekly"
    data["workflow"]["title"] = "Weekly"
    response = self.api.post(Workflow, data)
    self.assertEqual(response.status_code, 201)

  def test_create_monthly_workflows(self):
    data = self.get_workflow_dict()
    data["workflow"]["frequency"] = "monthly"
    data["workflow"]["title"] = "Monthly"
    response = self.api.post(Workflow, data)
    self.assertEqual(response.status_code, 201)

  def test_create_quarterly_workflows(self):
    data = self.get_workflow_dict()
    data["workflow"]["frequency"] = "quarterly"
    data["workflow"]["title"] = "Quarterly"
    response = self.api.post(Workflow, data)
    self.assertEqual(response.status_code, 201)

  def test_create_annually_workflows(self):
    data = self.get_workflow_dict()
    data["workflow"]["frequency"] = "annually"
    data["workflow"]["title"] = "Annually"
    response = self.api.post(Workflow, data)
    self.assertEqual(response.status_code, 201)

  def test_create_task_group(self):
    wf_data = self.get_workflow_dict()
    wf_data["workflow"]["title"] = "Create_task_group"
    wf_response = self.api.post(Workflow, wf_data)

    wf = wf_response.json["workflow"]
    data = self.get_task_group_dict(wf)

    response = self.api.post(TaskGroup, data)
    self.assertEqual(response.status_code, 201)

  def test_cycle_task_button_keys(self):
    from ggrc_workflows.models.task_group_object import TaskGroupObject
    from ggrc_workflows.models.task_group_task import TaskGroupTask
    from ggrc_workflows.models.cycle_task_group_object_task import CycleTaskGroupObjectTask
    from ggrc.models import Person
    from mock import MagicMock
    from ggrc import login # for get_current_user_id, mock it.

    weekly_wf = {
        "title": "weekly thingy",
        "description": "start this many a time",
        "frequency": "weekly",
        "task_groups": [{
            "title": "tg_2",
            "task_group_tasks": [
                {
                    'title': 'weekly task 1',
                    "relative_start_day": 2,  # Tuesday, 9th
                    "relative_start_month": None,
                    "relative_end_day": 4,  # Thursday, 11th
                    "relative_end_month": None,
                },
                {
                    'title': 'weekly task 2',
                    "relative_start_day": 3,  # Wednesday, 10th
                    "relative_start_month": None,
                    "relative_end_day": 1,  # 15th, Monday
                    "relative_end_month": None,
                }
            ],
            "task_group_objects": self.random_objects
        },
        ]
    }

    # region using generator
    default_user = Person.query.all()[0]  # email="user@example.com"
    # print("defalut_user", dir(defalut_user), defalut_user.email, defalut_user.id)
    self.generator.api.set_user(default_user)
    _, wf_gen = self.generator.generate_workflow(weekly_wf)
    _, tg = self.generator.generate_task_group(wf_gen)
    _, tgt = self.generator.generate_task_group_task(tg)
    # _, tgo = self.generator.generate_task_group_object(tgt)  # crash

    _, awf = self.generator.activate_workflow(wf_gen)

    tgt_found = TaskGroupTask.query.filter(TaskGroupTask.task_group_id == tg.id)
    tgo_found = TaskGroupObject.query.filter(TaskGroupObject.task_group_id == tg.id)
    tgt_obj = tgt_found.one()
    cycle_task_found = CycleTaskGroupObjectTask.query.filter(CycleTaskGroupObjectTask.task_group_task_id==tgt_obj.id)
    ct_obj = cycle_task_found.one()

    old_get_user_id = login.get_current_user_id
    login.get_current_user_id = lambda: default_user.id
    allow_decline = ct_obj.allow_decline
    allow_verify = ct_obj.allow_verify
    login.get_current_user_id = old_get_user_id

    self.assertTrue(allow_decline)
    self.assertTrue(allow_verify)
    # end region



  def test_relative_to_day(self):
    """Test relative day to date conversion for weekly workflows"""
    weekly_wf = {
        "title": "weekly thingy",
        "description": "start this many a time",
        "frequency": "weekly",
        "task_groups": [{
            "title": "tg_2",
            "task_group_tasks": [
                {
                    'title': 'weekly task 1',
                    "relative_start_day": 2,  # Tuesday, 9th
                    "relative_start_month": None,
                    "relative_end_day": 4,  # Thursday, 11th
                    "relative_end_month": None,
                }
            ],
            "task_group_objects": self.random_objects
        },
        ]
    }
    _, wf = self.generator.generate_workflow(weekly_wf)


  # TODO: Api should be able to handle invalid data
  @unittest.skip("Not implemented.")
  def test_create_task_group_invalid_workflow_data(self):
    wf = {"id": -1, "context": {"id": -1}}
    data = self.get_task_group_dict(wf)

    response = self.api.post(TaskGroup, data)
    self.assert400(response)

  def get_workflow_dict(self):
    data = {
        "workflow": {
            "custom_attribute_definitions": [],
            "custom_attributes": {},
            "title": "One_time",
            "description": "",
            "frequency": "one_time",
            "notify_on_change": False,
            "task_group_title": "Task Group 1",
            "notify_custom_message": "",
            "owners": None,
            "context": None,
        }
    }
    return data

  def get_task_group_dict(self, wf):
    data = {
        "task_group": {
            "custom_attribute_definitions": [],
            "custom_attributes": {},
            "_transient": {},
            "contact": {
                "id": 1,
                "href": "/api/people/1",
                "type": "Person"
            },
            "workflow": {
                "id": wf["id"],
                "href": "/api/workflows/%d" % wf["id"],
                "type": "Workflow"
            },
            "context": {
                "id": wf["context"]["id"],
                "href": "/api/contexts/%d" % wf["context"]["id"],
                "type": "Context"
            },
            "modal_title": "Create Task Group",
            "title": "Create_task_group",
            "description": "",
        }
    }
    return data
