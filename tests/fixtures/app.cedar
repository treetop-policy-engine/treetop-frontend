@id("App.read_documents")
permit (
    principal in App::Group::"readers",
    action == App::Action::"read",
    resource is App::Document
)
when {
    context.environment == "prod"
};
