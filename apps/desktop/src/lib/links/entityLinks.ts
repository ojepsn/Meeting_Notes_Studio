import type { EntityLinkRecord } from "@notesmith/domain";

export const findSessionIdForActivity = (links: EntityLinkRecord[], activityId: string) =>
  links.find(
    (link) =>
      link.fromType === "activity"
      && link.fromId === activityId
      && link.toType === "session"
      && link.relation === "has_session",
  )?.toId ?? null;

export const findSessionIdForTodo = (links: EntityLinkRecord[], todoId: string) =>
  links.find(
    (link) =>
      link.fromType === "todo"
      && link.fromId === todoId
      && link.toType === "session"
      && link.relation === "has_session",
  )?.toId ?? null;

export const findActivityIdForSession = (links: EntityLinkRecord[], sessionId: string) =>
  links.find(
    (link) =>
      link.fromType === "activity"
      && link.toType === "session"
      && link.toId === sessionId
      && link.relation === "has_session",
  )?.fromId ?? null;

export const findTodoIdForSession = (links: EntityLinkRecord[], sessionId: string) =>
  links.find(
    (link) =>
      link.fromType === "todo"
      && link.toType === "session"
      && link.toId === sessionId
      && link.relation === "has_session",
  )?.fromId ?? null;

export const upsertEntityLink = (links: EntityLinkRecord[], nextLink: EntityLinkRecord) => {
  const filtered = links.filter(
    (link) =>
      !(
        link.relation === nextLink.relation
        && link.fromType === nextLink.fromType
        && link.fromId === nextLink.fromId
        && link.toType === nextLink.toType
      ),
  );
  return [nextLink, ...filtered];
};
