function toRendererAuthState(authRecord) {
    if (!authRecord || !authRecord.user) {
        return {
            isLoggedIn: false,
            account: null,
            permissionSummary: null,
            reauthRequired: false
        };
    }

    const user = authRecord.user || {};
    const reauthRequired = authRecord.reauthRequired === true;
    return {
        isLoggedIn: !reauthRequired,
        account: {
            id: user.id,
            login: user.login,
            name: user.name,
            avatarUrl: user.avatarUrl,
            htmlUrl: user.htmlUrl
        },
        permissionSummary: authRecord.permissionSummary || null,
        reauthRequired
    };
}

module.exports = {
    toRendererAuthState
};
