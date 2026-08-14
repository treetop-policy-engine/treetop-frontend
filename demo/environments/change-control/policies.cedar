// The ticket condition is adapted from treetop-core 0.0.19's schema-backed
// request-context tests; the surrounding change-control model is demo-specific.

@id("ChangeControl.auditors_view")
permit (
    principal in ChangeControl::Group::"auditors",
    action == ChangeControl::Action::"view",
    resource is ChangeControl::ChangeRequest
);

@id("ChangeControl.reviewers_approve_staging")
permit (
    principal in ChangeControl::Group::"reviewers",
    action == ChangeControl::Action::"approve",
    resource is ChangeControl::ChangeRequest
)
when {
    context.ticket > 0 &&
    context.environment == "staging" &&
    resource.risk <= 3
};

@id("ChangeControl.admins_approve")
permit (
    principal in ChangeControl::Group::"admins",
    action == ChangeControl::Action::"approve",
    resource is ChangeControl::ChangeRequest
)
when { context.ticket > 0 };

// High-risk production changes require the explicit emergency path, even for admins.
@id("ChangeControl.block_high_risk_production")
forbid (
    principal,
    action == ChangeControl::Action::"approve",
    resource is ChangeControl::ChangeRequest
)
when {
    context.environment == "production" &&
    resource.risk >= 4 &&
    !context.emergency
};
