// Based on the photo permit/forbid example from treetop-rest v0.0.10
// testdata/default.cedar, extended with group grants. This environment
// intentionally has no Cedar schema.

@id("photos.alice_vacation_access")
permit (
    principal == User::"alice",
    action in [Action::"view", Action::"edit", Action::"delete"],
    resource == Photo::"VacationPhoto94.jpg"
);

@id("photos.family_can_view")
permit (
    principal in Group::"family",
    action == Action::"view",
    resource is Photo
);

@id("photos.editors_can_edit")
permit (
    principal in Group::"editors",
    action == Action::"edit",
    resource is Photo
);

@id("photos.owners_can_delete")
permit (
    principal in Group::"owners",
    action == Action::"delete",
    resource is Photo
);

@id("photos.alice_cannot_edit")
forbid (
    principal == User::"alice",
    action == Action::"edit",
    resource == Photo::"VacationPhoto94.jpg"
);

@id("photos.bob_cannot_delete_vacation_photo")
forbid (
    principal == User::"bob",
    action == Action::"delete",
    resource == Photo::"VacationPhoto94.jpg"
);
