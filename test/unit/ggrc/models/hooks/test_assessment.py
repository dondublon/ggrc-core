# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""A module with tests for the GGRC Workflow package.

It contains unit tests for the package's top level utility functions.
"""

import unittest

from mock import MagicMock, patch

from ggrc.models.hooks import assessment


@patch("ggrc.models.hooks.assessment.get_current_user_id")
@patch("ggrc.models.hooks.assessment.Person")
class GetValueTestCase(unittest.TestCase):
  """Tests for the get_value() function."""

  # pylint: disable=too-many-instance-attributes

  def setUp(self):
    self.person_1 = MagicMock(name="Person Bob")
    self.person_2 = MagicMock(name="Person John")
    self.person_3 = MagicMock(name="Person Mike")

    self.user_role_1 = MagicMock(person=self.person_1, role=MagicMock())
    self.user_role_1.role.name = u"Auditor"

    self.user_role_2 = MagicMock(person=self.person_2, role=MagicMock())
    self.user_role_2.role.name = u"Owner"

    self.user_role_3 = MagicMock(person=self.person_3, role=MagicMock())
    self.user_role_3.role.name = u"Auditor"

    self.audit = MagicMock(name="audit_1")
    self.audit.context.user_roles = [
        self.user_role_1, self.user_role_2, self.user_role_3
    ]

    self.related_object = MagicMock(name="assessment_1")
    self.related_object.revision.content = {}

  # pylint: disable=invalid-name
  def test_returns_auditors_as_default_verifiers_when_no_template(
      self, person_class, get_current_user_id
  ):
    """The function should return all Audit's assessors if no template given.
    """
    person_class.query.get.return_value = MagicMock(name="Person XY")
    get_current_user_id.return_value = 42

    people = assessment.get_value(
        "verifiers", [], self.audit, self.related_object, template=None)

    self.assertEqual(people, [self.person_1, self.person_3])

  # pylint: disable=invalid-name
  def test_returns_auditors_as_default_verifiers_when_set_in_template(
      self, person_class, get_current_user_id
  ):
    """The function should return all Audit's auditors if the template says so.
    """
    person_class.query.get.return_value = MagicMock(name="Person XY")
    get_current_user_id.return_value = 42

    assessment_template = MagicMock(
        default_people={"assessors": "Object Owners", "verifiers": "Auditors"}
    )

    people = assessment.get_value(
        "verifiers",
        [],
        self.audit,
        self.related_object,
        template=assessment_template
    )

    self.assertEqual(people, [self.person_1, self.person_3])
