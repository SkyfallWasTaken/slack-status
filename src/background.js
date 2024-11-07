import { getSlackAuth } from "./slack.js";

async function main() {
  let auth;
  try {
    auth = await getSlackAuth();
  } catch (e) {
    console.error(e);
    await openSettings();
    return;
  }

  const { enabled, authorized } = await chrome.storage.local.get({ enabled: true, authorized: false });
  if (!authorized) {
    const authd = confirm("Welcome to Slack Status!\n\nWe use your Slack auth cookie to connect to your Slack account. By pressing OK, you agree to this. Your token is *never* shared with anyone else.\n\nIf you do not agree to this, please click 'Cancel' and uninstall the extension.");
    if (authd) {
      await openSettings();
      await chrome.storage.local.set({ authorized: true });
    } else {
      alert("Okay, we'll uninstall the extension for you. We'll also open the GitHub if you'd like to try this again.");
      await chrome.tabs.create({ url: "https://github.com/SkyfallWasTaken/slack-status" });
      await chrome.management.uninstallSelf();
    }
  }

  let lastTabId = -1;
  while (true) {
    let queryOptions = { active: true, lastFocusedWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    if (!tab) continue;
    if (tab.id === lastTabId) continue;
    lastTabId = tab.id || 0;
    if (enabled) {
      updateStatus(tab.id || 0, auth);
    }
    await delay(1200);
  }
}

/**
 * @type (tabId: number, config: { xoxc: string, xoxd: string, teamDomain: string }) => Promise<void>
 */
async function updateStatus(tabId, auth) {
  console.debug("Tab activated:", tabId);
  const tab = await chrome.tabs.get(tabId);
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.title,
    });
  } catch {
    console.warn(`Tab ${tabId} is not accessible - probably a browser page?`);
    return;
  }
  const title = results[0].result || tab.title;

  const data = new FormData();
  data.append("token", auth.xoxc);
  data.append(
    "profile",
    JSON.stringify({
      status_emoji: ":globe_with_meridians:",
      status_text: redactAndTruncate(`On ${title}`, new URL(tab.url || tab.pendingUrl || "placeholder.com"), 100),
    }),
  );
  await fetch(`https://${auth.teamDomain}.slack.com/api/users.profile.set`, {
    method: "POST",
    body: data,
    headers: {
      Cookie: `d=${encodeURIComponent(auth.xoxd)}`,
    },
  });
  console.log("Updated status to", title);
}

chrome.action.onClicked.addListener(async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL("src/settings.html") });
});


/** @type Record<string, string> */
const redactions = {
  "mail.google.com": "Gmail",
  "outlook.live.com": "Outlook",
  "outlook.office.com": "Outlook",
  "teams.microsoft.com": "Teams",
}
const emailRegex = /\b[\w-\.]+@([\w-]+\.)+[\w-]{2,4}\b/g;
/** @type (input: string, url: URL, length: number) => string */
function redactAndTruncate(input, url, length) {
  let redacted = input.replaceAll(emailRegex, "[email]");
  const domain = new URL(url).hostname;
  if (redactions[domain]) {
    redacted = "On " + redactions[domain];
  }
  if (input.length <= length) return redacted;
  if (length < 3) return redacted.substring(0, length);
  return redacted.substring(0, length - 3) + "...";
}

/** @type (ms: number) => Promise<void> */
async function delay(ms) {
  return await new Promise((resolve) => setTimeout(resolve, ms));
}

async function openSettings() {
  await chrome.tabs.create({ url: chrome.runtime.getURL("src/settings.html") });
}

main();
