async function getSlackConfig() {
    const xoxd = (await chrome.cookies.get({
        name: "d",
        url: "https://app.slack.com"
    }))?.value;
    if (!xoxd) throw new Error("Failed to get xoxd");

    const slackTab = await chrome.tabs.create({
        url: "https://app.slack.com/404",
        active: false
    });
    if (!slackTab.id) throw new Error("Failed to create tab");
    console.debug(`Created Slack tab: ${slackTab.id}`)

    const results = await chrome.scripting.executeScript({
        target: { tabId: slackTab.id },
        func: () => localStorage.getItem("localConfig_v2"),
        injectImmediately: true
    });

    const localConfig = results[0].result;
    if (!localConfig) throw new Error("Failed to get xoxc");
    const config = JSON.parse(localConfig);
    const firstWorkspace = Object.keys(config.teams)[0];
    if (!firstWorkspace) throw new Error("Failed to get first workspace - are you signed in?");
    const team = config.teams[firstWorkspace];
    const xoxc = team?.token;
    const teamDomain = team?.domain;

    chrome.tabs.remove(slackTab.id);
    return {
        xoxd,
        xoxc,
        teamDomain
    }
}

async function main() {
    const config = await getSlackConfig()
    chrome.tabs.onActivated.addListener((activeInfo) => {
        (async () => {
            console.log("Tab activated")
            const tab = await chrome.tabs.get(activeInfo.tabId);
            if (!tab.title) return;

            const data = new FormData();
            data.append('token', config.xoxc);
            data.append('profile', JSON.stringify({
                status_emoji: ':globe_with_meridians:',
                status_text: `On ${tab.title}`
            }))
            await fetch(`https://${config.teamDomain}.slack.com/api/users.profile.set`, {
                method: 'POST',
                body: data,
                headers: {
                    Cookie: `d=${encodeURIComponent(config.xoxd)}`
                }
            })
            console.log("Updated status to", tab.title)
        })()
    });
}

main();