# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Module containing Cycle tasks.
"""

from sqlalchemy import orm, and_, select
from sqlalchemy.orm import foreign, remote
from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.ext.declarative import declared_attr

from ggrc import db
from ggrc.builder import simple_property
from ggrc.models.computed_property import computed_property
from ggrc.models.mixins import Base
from ggrc.models.mixins import Described
from ggrc.models.mixins import Notifiable
from ggrc.models.mixins import Slugged
from ggrc.models.mixins import Stateful
from ggrc.models.mixins import Timeboxed
from ggrc.models.mixins import Titled
from ggrc.models.mixins import WithContact
from ggrc.models.reflection import PublishOnly
from ggrc.models.relationship import Relatable
from ggrc.models.types import JsonType
from ggrc_workflows.models.cycle import Cycle
from ggrc_workflows.models.cycle_task_group import CycleTaskGroup
from ggrc.fulltext.attributes import (
    FullTextAttr,
    MultipleSubpropertyFullTextAttr,
    DateFullTextAttr
)
from ggrc.fulltext.mixin import Indexed, ReindexRule
from ggrc.login import get_current_user_id
import pdb

class CycleTaskGroupObjectTask(
        WithContact, Stateful, Timeboxed, Relatable, Notifiable,
        Described, Titled, Slugged, Base, Indexed, db.Model):
  """Cycle task model
  """
  __tablename__ = 'cycle_task_group_object_tasks'

  readable_name_alias = 'cycle task'

  _title_uniqueness = False

  IMPORTABLE_FIELDS = (
      'slug', 'title', 'description', 'start_date',
      'end_date', 'finished_date', 'verified_date',
      'contact',
  )

  @classmethod
  def generate_slug_prefix_for(cls, obj):
    return "CYCLETASK"

  VALID_STATES = (None, 'InProgress', 'Assigned',
                  'Finished', 'Declined', 'Verified')

  # Note: this statuses are used in utils/query_helpers to filter out the tasks
  # that should be visible on My Tasks pages.
  ACTIVE_STATES = ("Assigned", "InProgress", "Finished", "Declined")

  PROPERTY_TEMPLATE = u"task {}"

  _fulltext_attrs = [
      DateFullTextAttr("end_date", 'end_date',),
      FullTextAttr("assignee", 'contact', ['name', 'email']),
      FullTextAttr("group title", 'cycle_task_group', ['title'], False),
      FullTextAttr("cycle title", 'cycle', ['title'], False),
      FullTextAttr("group assignee",
                   lambda x: x.cycle_task_group.contact,
                   ['email', 'name'], False),
      FullTextAttr("cycle assignee",
                   lambda x: x.cycle.contact,
                   ['email', 'name'], False),
      DateFullTextAttr("group due date",
                       lambda x: x.cycle_task_group.next_due_date,
                       with_template=False),
      DateFullTextAttr("cycle due date",
                       lambda x: x.cycle.next_due_date,
                       with_template=False),
      MultipleSubpropertyFullTextAttr("comments",
                                      "cycle_task_entries",
                                      ["description"]),
      FullTextAttr("allow_decline", "allow_decline")
  ]

  AUTO_REINDEX_RULES = [
      ReindexRule("CycleTaskEntry", lambda x: x.cycle_task_group_object_task),
  ]

  cycle_id = db.Column(
      db.Integer,
      db.ForeignKey('cycles.id', ondelete="CASCADE"),
      nullable=False,
  )
  cycle_task_group_id = db.Column(
      db.Integer,
      db.ForeignKey('cycle_task_groups.id', ondelete="CASCADE"),
      nullable=False,
  )
  task_group_task_id = db.Column(
      db.Integer, db.ForeignKey('task_group_tasks.id'), nullable=True)
  task_group_task = db.relationship(
      "TaskGroupTask",
      foreign_keys="CycleTaskGroupObjectTask.task_group_task_id"
  )
  task_type = db.Column(
      db.String(length=250), nullable=False)
  response_options = db.Column(
      JsonType(), nullable=False, default=[])
  selected_response_options = db.Column(
      JsonType(), nullable=False, default=[])

  sort_index = db.Column(
      db.String(length=250), default="", nullable=False)

  finished_date = db.Column(db.DateTime)
  verified_date = db.Column(db.DateTime)

  object_approval = association_proxy('cycle', 'workflow.object_approval')
  object_approval.publish_raw = True

  @property
  def cycle_task_objects_for_cache(self):
    """Changing task state must invalidate `workflow_state` on objects
    """
    return [(object_.__class__.__name__, object_.id) for object_ in
            self.related_objects]  # pylint: disable=not-an-iterable

  _publish_attrs = [
      'cycle',
      'cycle_task_group',
      'task_group_task',
      'cycle_task_entries',
      'sort_index',
      'task_type',
      'response_options',
      'selected_response_options',
      PublishOnly('object_approval'),
      PublishOnly('finished_date'),
      PublishOnly('verified_date'),
      PublishOnly('allow_decline'),
      PublishOnly('allow_verify')
  ]

  default_description = "<ol>"\
                        + "<li>Expand the object review task.</li>"\
                        + "<li>Click on the Object to be reviewed.</li>"\
                        + "<li>Review the object in the Info tab.</li>"\
                        + "<li>Click \"Approve\" to approve the object.</li>"\
                        + "<li>Click \"Decline\" to decline the object.</li>"\
                        + "</ol>"

  _aliases = {
      "title": "Summary",
      "description": "Task Details",
      "contact": {
          "display_name": "Assignee",
          "mandatory": True,
      },
      "secondary_contact": None,
      "finished_date": "Actual Finish Date",
      "verified_date": "Actual Verified Date",
      "cycle": {
          "display_name": "Cycle",
          "filter_by": "_filter_by_cycle",
      },
      "cycle_task_group": {
          "display_name": "Task Group",
          "mandatory": True,
          "filter_by": "_filter_by_cycle_task_group",
      },
      "task_type": {
          "display_name": "Task Type",
          "mandatory": True,
      },
      "status": {
          "display_name": "State",
          "mandatory": False,
          "description": "Options are:\n{}".
                          format('\n'.join((item for item in VALID_STATES
                                            if item)))
      },
      "end_date": "Due Date",
      "start_date": "Start Date",
  }

  @computed_property
  def related_objects(self):
    """Compute and return a list of all the objects related to this cycle task.

    Related objects are those that are found either on the "source" side, or
    on the "destination" side of any of the instance's relations.

    Returns:
      (list) All objects related to the instance.
    """
    # pylint: disable=not-an-iterable
    sources = [r.source for r in self.related_sources]
    destinations = [r.destination for r in self.related_destinations]
    return sources + destinations

  #def logged_equal_to_contact(self):
  #  return

  @declared_attr
  def user_role(self):
    # Assignee for a task logged id
    # task_id_ok = get_current_user_id() == self.contact_id
    from ggrc_basic_permissions.models import UserRole

    # relationship to user role
    r_ur = db.relationship(
        UserRole,
        primaryjoin=lambda : self.context_id==foreign(UserRole.context_id)
    )

    return r_ur

  @simple_property
  def allow_decline(self):
    return self.logged_wfo_or_assignee()

  def logged_wfo_or_assignee(self):
      """Workflow owner if assignee logged in.
       Used in "allow_decline" and "allow_verify"
      """
      logged_assignee = get_current_user_id() == self.contact_id
      user_role = self.user_role
      if len(user_role) == 0:
          return logged_assignee
      else: # two or more
          persons_ids = [ur.person_id for ur in user_role]
          logged_workflow_owner = get_current_user_id() in persons_ids
          return logged_assignee or logged_workflow_owner

  @simple_property
  def allow_verify(self):
    return self.logged_wfo_or_assignee()

  @classmethod
  def _filter_by_cycle(cls, predicate):
    """Get query that filters cycle tasks by related cycles.

    Args:
      predicate: lambda function that excepts a single parameter and returns
      true of false.

    Returns:
      An sqlalchemy query that evaluates to true or false and can be used in
      filtering cycle tasks by related cycles.
    """
    return Cycle.query.filter(
        (Cycle.id == cls.cycle_id) &
        (predicate(Cycle.slug) | predicate(Cycle.title))
    ).exists()

  @classmethod
  def _filter_by_cycle_task_group(cls, predicate):
    """Get query that filters cycle tasks by related cycle task groups.

    Args:
      predicate: lambda function that excepts a single parameter and returns
      true of false.

    Returns:
      An sqlalchemy query that evaluates to true or false and can be used in
      filtering cycle tasks by related cycle task groups.
    """
    return CycleTaskGroup.query.filter(
        (CycleTaskGroup.id == cls.cycle_id) &
        (predicate(CycleTaskGroup.slug) | predicate(CycleTaskGroup.title))
    ).exists()

  @classmethod
  def eager_query(cls):
    """Add cycle task entries to cycle task eager query

    This function adds cycle_task_entries as a join option when fetching cycles
    tasks, and makes sure that with one query we fetch all cycle task related
    data needed for generating cycle taks json for a response.

    Returns:
      a query object with cycle_task_entries added to joined load options.
    """

    query = super(CycleTaskGroupObjectTask, cls).eager_query()
    # ones_column = sql.literal_column('true', type_=None)

    result = query.options(
        orm.joinedload('cycle')
           .joinedload('workflow')
           .undefer_group('Workflow_complete'),
        orm.joinedload('cycle_task_entries')
    )
    return result

  @classmethod
  def indexed_query(cls):
    return super(CycleTaskGroupObjectTask, cls).indexed_query().options(

      orm.Load(cls).load_only(
            "end_date",
            "start_date",
            "created_at",
            "updated_at"
        ),
        orm.Load(cls).joinedload("cycle_task_group").load_only(
            "id",
            "title",
            "end_date",
            "next_due_date",
        ),
        orm.Load(cls).joinedload("cycle").load_only(
            "id",
            "title",
            "next_due_date"
        ),
        orm.Load(cls).joinedload("cycle_task_group").joinedload(
            "contact"
        ).load_only(
            "email",
            "name",
            "id"
        ),
        orm.Load(cls).joinedload("cycle").joinedload(
            "contact"
        ).load_only(
            "email",
            "name",
            "id"
        ),
        orm.Load(cls).subqueryload("cycle_task_entries").load_only(
            "description",
            "id"
        ),
        orm.Load(cls).joinedload("contact").load_only(
            "email",
            "name",
            "id"
        ),
    )


class CycleTaskable(object):
  """ Requires the Relatable mixin, otherwise cycle_task_group_object_tasks
  fails to fetch related objects
  """
  @computed_property
  def cycle_task_group_object_tasks(self):
    """ Lists all the cycle tasks related to a certain object
    """
    sources = [r.CycleTaskGroupObjectTask_source
               for r in self.related_sources
               if r.CycleTaskGroupObjectTask_source is not None]
    destinations = [r.CycleTaskGroupObjectTask_destination
                    for r in self.related_destinations
                    if r.CycleTaskGroupObjectTask_destination is not None]
    return sources + destinations

  @classmethod
  def eager_query(cls):
    query = super(CycleTaskable, cls).eager_query()
    return query.options(
        orm.subqueryload('related_sources')
           .joinedload('CycleTaskGroupObjectTask_source')
           .undefer_group('CycleTaskGroupObjectTask_complete')
           .joinedload('cycle'),
        orm.subqueryload('related_destinations')
           .joinedload('CycleTaskGroupObjectTask_destination')
           .undefer_group('CycleTaskGroupObjectTask_complete')
           .joinedload('cycle')
    )
