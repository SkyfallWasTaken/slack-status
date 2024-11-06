async function getSlackConfig() {
  const xoxd = (
    await chrome.cookies.get({
      name: "d",
      url: "https://app.slack.com",
    })
  )?.value;
  if (!xoxd) throw new Error("Failed to get xoxd");

  const slackTab = await chrome.tabs.create({
    url: "https://app.slack.com/404",
    active: false,
  });
  if (!slackTab.id) throw new Error("Failed to create tab");
  console.debug(`Created Slack tab: ${slackTab.id}`);

  const results = await chrome.scripting.executeScript({
    target: { tabId: slackTab.id },
    func: () => localStorage.getItem("localConfig_v2"),
    injectImmediately: true,
  });

  const localConfig = results[0].result;
  if (!localConfig) throw new Error("Failed to get xoxc");
  const config = JSON.parse(localConfig);
  const firstWorkspace = Object.keys(config.teams)[0];
  if (!firstWorkspace)
    throw new Error("Failed to get first workspace - are you signed in?");
  const team = config.teams[firstWorkspace];
  const xoxc = team?.token;
  const teamDomain = team?.domain;

  setTimeout(() => {
    chrome.tabs.remove(slackTab.id || chrome.tabs.TAB_ID_NONE);
  }, 1000);
  return {
    xoxd,
    xoxc,
    teamDomain,
  };
}

async function main() {
  const config = await getSlackConfig();

  let lastTabId = -1;
  while (true) {
    let queryOptions = { active: true, lastFocusedWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    if (tab.id === lastTabId) return;
    if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("firefox://") || tab.url?.startsWith("edge://")) return;
    lastTabId = tab.id || 0;
    updateStatus(tab.id || 0, config);
    await delay(1200);
  }
}

/**
 * @type (tabId: number, config: { xoxc: string, xoxd: string, teamDomain: string }) => Promise<void>
 */
async function updateStatus(tabId, config) {
  console.debug("Tab activated:", tabId);
  const tab = await chrome.tabs.get(tabId);
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => document.title,
  });
  const title = results[0].result || tab.title;

  const data = new FormData();
  data.append("token", config.xoxc);
  data.append(
    "profile",
    JSON.stringify({
      status_emoji: ":globe_with_meridians:",
      status_text: truncate(`On ${title}`, 100),
    }),
  );
  await fetch(`https://${config.teamDomain}.slack.com/api/users.profile.set`, {
    method: "POST",
    body: data,
    headers: {
      Cookie: `d=${encodeURIComponent(config.xoxd)}`,
    },
  });
  console.log("Updated status to", title);
}

/** @type (input: string, length: number) => string */
function truncate(input, length) {
  if (input.length <= length) return input;
  if (length < 3) return input.substring(0, length);
  return input.substring(0, length - 3) + "...";
}

/** @type (ms: number) => Promise<void> */
async function delay(ms) {
  // return await for better async stack trace support in case of errors.
  return await new Promise((resolve) => setTimeout(resolve, ms));
}

main();
