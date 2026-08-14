// Adapted from treetop-rest v0.0.10 testdata/dns.cedar.

@id("DNS.admins_policy")
permit (
    principal in DNS::Group::"admins",
    action in [
        DNS::Action::"create_host",
        DNS::Action::"delete_host",
        DNS::Action::"view_host",
        DNS::Action::"edit_host"
    ],
    resource is DNS::Host
);

@id("DNS.webadmins_policy")
permit (
    principal in DNS::Group::"webadmins",
    action in [
        DNS::Action::"edit_host",
        DNS::Action::"delete_host",
        DNS::Action::"create_host"
    ],
    resource is DNS::Host
)
when {
    resource.nameLabels.contains("valid_webserver_name") &&
    resource.ip.isInRange(ip("192.168.1.0/24"))
};

@id("DNS.users_policy")
permit (
    principal in DNS::Group::"users",
    action == DNS::Action::"view_host",
    resource is DNS::Host
);

@id("DNS.charlie_forbid_delete_host_policy")
forbid (
    principal == DNS::User::"charlie",
    action == DNS::Action::"delete_host",
    resource is DNS::Host
);

@id("DNS.admins_ip_network_policy")
permit (
    principal in DNS::Group::"admins",
    action == DNS::Action::"ip_network_management",
    resource is DNS::IPAddress
);

@id("DNS.users_ip_network_policy")
permit (
    principal in DNS::Group::"users",
    action == DNS::Action::"ip_network_management",
    resource is DNS::IPAddress
)
when {
    resource.ip.isInRange(ip("192.168.1.0/24")) ||
    resource.ip.isInRange(ip("10.0.0.0/8"))
};

@id("DNS.labels_admin_policy")
permit (
    principal in DNS::Group::"admins",
    action in [
        DNS::Action::"create_label",
        DNS::Action::"delete_label",
        DNS::Action::"view_label",
        DNS::Action::"edit_label"
    ],
    resource is DNS::Label
);
