# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Integration tests for Assessment"""

from collections import OrderedDict

from ggrc import db
from ggrc.models import Assessment
from ggrc.models import Revision
from ggrc.converters import errors
from integration.ggrc import TestCase
from integration.ggrc.api_helper import Api
from integration.ggrc.models import factories
from integration.ggrc_basic_permissions.models \
    import factories as rbac_factories

from ggrc_basic_permissions.models import Role
from ggrc_basic_permissions.models import UserRole


class TestAssessment(TestCase):
  """Assessment test cases"""
  # pylint: disable=invalid-name

  def setUp(self):
    super(TestAssessment, self).setUp()
    self.api = Api()

  def test_auto_slug_generation(self):
    """Test auto slug generation"""
    factories.AssessmentFactory(title="Some title")
    ca = Assessment.query.first()
    self.assertEqual("ASSESSMENT-{}".format(ca.id), ca.slug)

  def test_enabling_comment_notifications_by_default(self):
    """New Assessments should have comment notifications enabled by default."""
    asmt = factories.AssessmentFactory()

    self.assertTrue(asmt.send_by_default)
    recipients = asmt.recipients.split(",") if asmt.recipients else []
    self.assertEqual(sorted(recipients), ["Assessor", "Creator", "Verifier"])

  def test_audit_changes_api(self):
    """Test that users can't change the audit mapped to an assessment."""
    audit_id = factories.AuditFactory().id
    asmt = factories.AssessmentFactory()
    correct_audit_id = asmt.audit_id
    response = self.api.put(asmt, {"audit": {"type": "Audit", "id": audit_id}})
    self.assert400(response)
    assessment = Assessment.query.first()
    self.assertEqual(assessment.audit_id, correct_audit_id)

  def test_put_no_audit_change(self):
    """Test that put requests works without audit changes"""
    asmt = factories.AssessmentFactory()
    correct_audit_id = asmt.audit_id
    response = self.api.put(asmt, {"audit": {
        "type": "Audit", "id": correct_audit_id
    }})
    self.assert200(response)
    assessment = Assessment.query.first()
    self.assertEqual(assessment.audit_id, correct_audit_id)

  def test_audit_changes_import(self):
    """Test that users can't change the audit mapped to an assessment."""
    audit = factories.AuditFactory()
    asmt = factories.AssessmentFactory()
    correct_audit_id = asmt.audit_id
    response = self.import_data(OrderedDict([
        ("object_type", "Assessment"),
        ("Code*", asmt.slug),
        ("audit", audit.slug),
    ]))
    self._check_csv_response(response, {
        "Assessment": {
            "row_warnings": {
                errors.UNMODIFIABLE_COLUMN.format(line=3, column_name="Audit")
            }
        }
    })
    assessment = Assessment.query.first()
    self.assertEqual(assessment.audit_id, correct_audit_id)

  def test_no_audit_change_imports(self):
    """Test that imports work if audit field does not contain changes."""
    factories.AuditFactory()
    asmt = factories.AssessmentFactory()
    correct_audit_id = asmt.audit_id
    response = self.import_data(OrderedDict([
        ("object_type", "Assessment"),
        ("Code*", asmt.slug),
        ("audit", asmt.audit.slug),
    ]))
    self._check_csv_response(response, {})
    assessment = Assessment.query.first()
    self.assertEqual(assessment.audit_id, correct_audit_id)

  def test_empty_audit_import(self):
    """Test empty audit import"""
    factories.AuditFactory()
    asmt = factories.AssessmentFactory()
    correct_audit_id = asmt.audit_id
    response = self.import_data(OrderedDict([
        ("object_type", "Assessment"),
        ("Code*", asmt.slug),
        ("audit", ""),
    ]))
    self._check_csv_response(response, {})
    assessment = Assessment.query.first()
    self.assertEqual(assessment.audit_id, correct_audit_id)


class TestAssessmentGeneration(TestCase):
  """Test assessment generation"""
  # pylint: disable=invalid-name

  def setUp(self):
    super(TestAssessmentGeneration, self).setUp()
    self.api = Api()

    self.audit = factories.AuditFactory()
    self.control = factories.ControlFactory(
        test_plan="Control Test Plan"
    )
    revision = Revision.query.filter(
        Revision.resource_id == self.control.id,
        Revision.resource_type == self.control.__class__.__name__
    ).order_by(
        Revision.id.desc()
    ).first()
    self.snapshot = factories.SnapshotFactory(
        parent=self.audit,
        child_id=self.control.id,
        child_type=self.control.__class__.__name__,
        revision_id=revision.id
    )

  def assessment_post(self, template=None):
    """Helper function to POST an assessment"""
    assessment_dict = {
        "_generated": True,
        "audit": {
            "id": self.audit.id,
            "type": "Audit"
        },
        "object": {
            "id": self.snapshot.id,
            "type": "Snapshot"
        },
        "context": {
            "id": self.audit.context.id,
            "type": "Context"
        },
        "title": "Temp title"
    }
    if template:
      assessment_dict["template"] = {
          "id": template.id,
          "type": "AssessmentTemplate"
      }

    return self.api.post(Assessment, {
        "assessment": assessment_dict
    })

  def test_autogenerated_title(self):
    """Test autogenerated assessment title"""
    control_title = self.control.title
    audit_title = self.audit.title
    response = self.assessment_post()
    title = response.json["assessment"]["title"]
    self.assertIn(audit_title, title)
    self.assertIn(control_title, title)

  def test_autogenerated_assignees_verifiers(self):
    """Test autogenerated assessment assignees"""
    auditor_role = Role.query.filter_by(name="Auditor").first()

    audit_context = factories.ContextFactory()
    self.audit.context = audit_context

    users = ["user1@example.com", "user2@example.com"]

    auditors = []
    for user in users:
      person = factories.PersonFactory(email=user)
      auditors += [person]

    for auditor in auditors:
      rbac_factories.UserRoleFactory(
          context=audit_context,
          role=auditor_role,
          person=auditor)

    self.assertEqual(
        UserRole.query.filter_by(
            role=auditor_role,
            context=self.audit.context).count(), 2, "Auditors not present")

    response = self.assessment_post()
    verifiers = response.json["assessment"]["assignees"]["Verifier"]
    verifiers = set([v.get("email") for v in verifiers])
    self.assertEqual(verifiers, set(users))

    assessors = response.json["assessment"]["assignees"]["Assessor"]
    assessor = assessors[0].get("email")
    db.session.add(self.audit)
    self.assertEqual(assessor, self.audit.contact.email)

    creators = response.json["assessment"]["assignees"]["Creator"]
    creators = set([c.get("email") for c in creators])
    self.assertEqual(set(creators), {"user@example.com"})

  def test_template_test_plan(self):
    """Test if generating assessments from template sets default test plan"""
    template = factories.AssessmentTemplateFactory(
        test_plan_procedure=False,
        procedure_description="Assessment Template Test Plan"
    )
    response = self.assessment_post(template)
    self.assertEqual(response.json["assessment"]["test_plan"],
                     template.procedure_description)

  def test_control_test_plan(self):
    """Test test_plan from control"""
    test_plan = self.control.test_plan
    template = factories.AssessmentTemplateFactory(
        test_plan_procedure=True
    )
    response = self.assessment_post(template)
    self.assertEqual(response.json["assessment"]["test_plan"],
                     test_plan)
