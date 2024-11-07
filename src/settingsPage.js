async function main() {
    const workspaceSelect = document.getElementById("workspace-select");
    const enabledSwitch = document.getElementById("enable");

    const { workspaces, selectedWorkspaceId } = await chrome.storage.local.get({
        workspaces: [],
        enabled: true,
        selectedWorkspaceId: null,
    });

    if (workspaces.length != 0) {
        // @ts-ignore
        for (const workspaceId of Object.keys(workspaces)) {
            const workspace = workspaces[workspaceId];
            console.log(workspace)
            const option = document.createElement("option");
            option.value = workspace;
            option.innerText = workspace.name;
            if (workspaceId === selectedWorkspaceId) {
                option.selected = true;
            }
            workspaceSelect?.appendChild(option);
        }
    } else {
        const option = document.createElement("option");
        option.value = "none";
        option.innerText = "No workspaces found";
        option.selected = true;
        workspaceSelect?.setAttribute("disabled", "true");
        workspaceSelect?.appendChild(option);
    }

    workspaceSelect?.addEventListener("change", (event) => {
        if (event.target && 'value' in event.target) {
            chrome.storage.local.set({ selectedWorkspaceId: event.target.value });
        }
    });
    enabledSwitch?.addEventListener("change", (event) => {
        if (event.target && 'value' in event.target) {
            chrome.storage.local.set({ enabled: event.target.value });
        }
    });
}

main()