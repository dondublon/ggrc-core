# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""
  Assessment generator hooks

  We are applying assessment template properties and make
  new relationships and custom attributes
"""
import logging
from itertools import izip

from sqlalchemy import inspect

from ggrc import db
from ggrc.login import get_current_user_id
from ggrc.models import all_models
from ggrc.models import Assessment
from ggrc.models import Issue
from ggrc.models import Person
from ggrc.models import Relationship
from ggrc.models import Snapshot
from ggrc.services.common import Resource

logger = logging.getLogger(__name__)  # pylint: disable=invalid-name


def _preload_roles(related, roles=None):
  """Preload user roles needed for setting assignees"""
  if roles is not None:
    return roles
  object_type = getattr(related.get('template'), 'template_object_type', None)
  return all_models.AccessControlRole.query.filter(
      all_models.AccessControlRole.name.in_((
          "Primary Contacts",
          "Secondary Contacts",
          "Principal Assignees",
          "Secondary Assignees"
      )),
      all_models.AccessControlRole.object_type == object_type
  ).all()


def init_hook():
  """ Initialize hooks"""
  # pylint: disable=unused-variable
  @Resource.collection_posted.connect_via(Assessment)
  def handle_assessment_post(sender, objects=None, sources=None):
    # pylint: disable=unused-argument
    """Apply custom attribute definitions and map people roles
    when generating Assessmet with template"""
    db.session.flush()

    snapshot_ids = [src.get('object', {}).get('id') for src in sources]
    snapshots = Snapshot.eager_query().filter(Snapshot.id.in_(snapshot_ids))
    snapshots = {snapshot.id: snapshot for snapshot in snapshots}
    roles = None
    for obj, src in izip(objects, sources):
      src_obj = src.get("object")
      audit = src.get("audit")
      map_objects(obj, src_obj)
      map_objects(obj, audit)

      if not src.get("_generated"):
        continue

      related = {
          "template": get_by_id(src.get("template")),
          "obj": get_by_id(src_obj),
          "audit": get_by_id(audit),
      }

      roles = _preload_roles(related, roles)

      relate_assignees(obj, related, roles)
      relate_ca(obj, related)

      if src_obj:
        snapshot = snapshots.get(src_obj.get('id'))
        if snapshot:
          obj.title = u'{} assessment for {}'.format(
              snapshot.revision.content['title'], snapshot.parent.title)
          template = related.get('template')
          if not template:
            continue
          if template.test_plan_procedure:
            test_plan = snapshot.revision.content['test_plan']
          else:
            test_plan = template.procedure_description
          obj.test_plan = test_plan

  @Resource.model_put.connect_via(Assessment)
  @Resource.model_put.connect_via(Issue)
  def handle_assessment_put(sender, obj=None, src=None, service=None):
    # pylint: disable=unused-argument
    if inspect(obj).attrs["audit"].history.added or \
            inspect(obj).attrs["audit"].history.deleted:
      raise ValueError("Audit field should not be changed")


@Resource.collection_posted.connect_via(Issue)
def handle_issue_post(sender, objects=None, sources=None):
  # pylint: disable=unused-argument
  """Map issue to audit. This makes sure an auditor is able to create
  an issue on the audit without having permissions to create Relationships
  in the context"""

  for obj, src in izip(objects, sources):
    audit = src.get("audit")
    assessment = src.get("assessment")
    map_objects(obj, audit)
    map_objects(obj, assessment)


def map_objects(src, dst):
  """Creates a relationship between an src and dst. This also
  generates automappings. Fails silently if dst dict does not have id and type
  keys.

  Args:
    src (model): The src model
    dst (dict): A dict with `id` and `type`.
  Returns:
    None
  """
  dst = dst or {}
  if 'id' not in dst or 'type' not in dst:
    return
  rel = Relationship(**{
      "source": src,
      "destination_id": dst["id"],
      "destination_type": dst["type"],
      "context": src.context,
  })
  db.session.add(rel)


def get_by_id(obj):
  """Get object instance by id"""
  if not obj:
    return

  model = get_model_query(obj["type"])
  return model.get(obj["id"])


def get_model_query(model_type):
  """Get model query"""
  model = getattr(all_models, model_type, None)
  return db.session.query(model)


def get_user_roles(obj, people, roles):
  """Gets people with the given role on the object"""
  people_roles = [r.id for r in roles if r.name == people]
  if not people_roles:
    logger.warn("%s custom role does not exist for %s",
                people, obj['title'])
    return
  role_id = people_roles[0]
  return [get_by_id({
      'type': 'Person',
      'id': acl.get('person_id')
  }) for acl in obj.get('access_control_list', [])
      if acl.get('ac_role_id') == role_id]


# pylint: disable=too-many-return-statements
def get_value(people_group, roles, audit, obj, template=None):
  """Return the people related to an Audit belonging to the given role group.

  Args:
    people_group: (string) the name of the group of people to return,
      e.g. "assessors"
    roles: (AccessControlRoles list) list of access control roles
    template: (ggrc.models.AssessmentTemplate) a template to take into
      consideration
    audit: (ggrc.models.Audit) an audit instance
    obj: an object related to `audit`, can be anything that can be mapped
      to an Audit, e.g. Control, Issue, Facility, etc.
  Returns:
    Either a Person object, a list of Person objects, or None if no people
    matching the criteria are found.
  """
  auditors = (
      user_role.person for user_role in audit.context.user_roles
      if user_role.role.name == u"Auditor"
  )

  if not template:
    if people_group == "creator":
      # don't use get_current_user because that returns a proxy
      return Person.query.get(get_current_user_id())
    elif people_group == "verifiers":
      return list(auditors)
    elif people_group == "assessors":
      return getattr(audit, "contact", None)

    return None

  people = template.default_people.get(people_group)
  if not people:
    return None
  elif isinstance(people, list):
    return [get_by_id({
        'type': 'Person',
        'id': person_id
    }) for person_id in people]

  types = {
      "Object Owners": lambda: [
          get_by_id(owner)
          for owner in obj.revision.content.get("owners", [])
      ],
      "Audit Lead": lambda: getattr(audit, "contact", None),
      "Auditors": lambda: list(auditors),
      "Primary Contacts": lambda: get_user_roles(
          obj.revision.content, people, roles),
      "Secondary Contacts": lambda: get_user_roles(
          obj.revision.content, people, roles),
      "Principal Assignees": lambda: get_user_roles(
          obj.revision.content, people, roles),
      "Secondary Assignees": lambda: get_user_roles(
          obj.revision.content, people, roles),
  }

  return types.get(people)()


def assign_people(assignees, assignee_role, assessment, relationships):
  """Create a list of people with roles

      Args:
        assignees (list of model instances): List of people
        assignee_role (string): It can be either Assessor or Verifier
        assessment (model instance): Assessment model
        relationships (list): List relationships between assignees and
                              assessment with merged AssigneeType's
  """
  assignees = assignees if isinstance(assignees, list) else [assignees]
  assignees = [assignee for assignee in assignees if assignee is not None]

  if not assignees and assignee_role != "Verifier":
    assignees.append(assessment.modified_by)

  for assignee in assignees:
    rel = (val for val in relationships if val["source"] == assignee)
    rel = next(rel, None)
    if rel:
      values = rel["attrs"]["AssigneeType"].split(",")
      values.append(assignee_role)
      rel["attrs"]["AssigneeType"] = ",".join(set(values))
    else:
      relationships.append(
          get_relationship_dict(assignee, assessment, assignee_role))


def get_relationship_dict(source, destination, role):
  """ Returns relationship object with Assignee Type"""
  return {
      "source": source,
      "destination": destination,
      "context": destination.context,
      "attrs": {
          "AssigneeType": role,
      },
  }


def relate_assignees(assessment, related, roles):
  """Generates assignee list and relates them to Assessment objects

    Args:
        assessment (model instance): Assessment model
        related (dict): Dict containing model instances related to assessment
                        - obj
                        - audit
                        - template (an AssessmentTemplate, can be None)
        roles (list of ACR instances): List of all roles
  """
  people_types = {
      "assessors": "Assessor",
      "verifiers": "Verifier",
      "creator": "Creator",
  }
  people_list = []

  for person_key, person_type in people_types.iteritems():
    assign_people(
        get_value(person_key, roles, **related),
        person_type, assessment, people_list)

  for person in people_list:
    if person['source'] is not None and person['destination'] is not None:
      rel = Relationship(
          source=person['source'],
          destination=person['destination'],
          context=person['context'])
      rel.attrs = person['attrs']
      db.session.add(rel)


def relate_ca(assessment, related):
  """Generates custom attribute list and relates it to Assessment objects

    Args:
        assessment (model instance): Assessment model
        related (dict): Dict containing model instances related to assessment
                        - template
                        - obj
                        - audit
  """
  if not related["template"]:
    return

  ca_query = all_models.CustomAttributeDefinition.eager_query()
  ca_definitions = ca_query.filter_by(
      definition_id=related["template"].id,
      definition_type="assessment_template",
  ).order_by(
      all_models.CustomAttributeDefinition.id
  )

  for definition in ca_definitions:
    cad = all_models.CustomAttributeDefinition(
        title=definition.title,
        definition=assessment,
        attribute_type=definition.attribute_type,
        multi_choice_options=definition.multi_choice_options,
        multi_choice_mandatory=definition.multi_choice_mandatory,
        mandatory=definition.mandatory,
        helptext=definition.helptext,
        placeholder=definition.placeholder,
    )
    db.session.add(cad)
