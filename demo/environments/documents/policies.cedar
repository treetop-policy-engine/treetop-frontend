// Adapted from treetop-core's schema and permit/forbid evaluation tests.

@id("Docs.alice_read")
permit (
    principal == Docs::User::"alice",
    action == Docs::Action::"view",
    resource is Docs::Document
);

@id("Docs.editors_read_and_edit")
permit (
    principal in Docs::Group::"editors",
    action in [Docs::Action::"view", Docs::Action::"edit"],
    resource is Docs::Document
);

@id("Docs.admins_delete")
permit (
    principal in Docs::Group::"admins",
    action == Docs::Action::"delete",
    resource is Docs::Document
);

// A forbid overrides the admins permit for highly sensitive documents.
@id("Docs.protect_sensitive_documents")
forbid (
    principal,
    action == Docs::Action::"delete",
    resource is Docs::Document
)
when { resource.sensitivity >= 4 };
