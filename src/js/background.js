// @flow
// Service worker for Manifest V3.
// Stays decoupled from the redux-observable epics used by the reader page:
// those modules pull in rxjs + lodash transforms that don't evaluate cleanly
// in Chrome's extension service worker. Anything the SW needs from a site
// adapter (chapter-page HTML scraping for subscription polling) is done
// inline via fetch().

import initObject from './util/initObject';

declare var chrome: any;

const SITES = [
  { key: 'dm5', regex: /^https?:\/\/(tel|www)\.dm5\.com\/(m\d+)\//, chapterGroup: 2 },
  { key: 'sf', regex: /^https?:\/\/comic\.sfacg\.com\/(HTML\/[^\/]+\/.+)$/, chapterGroup: 1 },
  { key: 'comicbus', regex: /^https?:\/\/(www|v)\.comicbus\.com\/online\/(comic-\d+\.html\?ch=.*)$/, chapterGroup: 2 },
];

function setAdultCookies() {
  if (!chrome.cookies || !chrome.cookies.set) return;
  const farFuture = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
  ['https://www.dm5.com/', 'http://www.dm5.com/'].forEach(url => {
    chrome.cookies.set({ url, name: 'isAdult', value: '1', path: '/', expirationDate: farFuture });
  });
}

chrome.action.setBadgeBackgroundColor({ color: '#F00' });

chrome.notifications.onClicked.addListener(id => {
  if (id !== 'Comics Scroller Update') {
    chrome.tabs.create({ url: id });
  }
  chrome.notifications.clear(id);
});

chrome.runtime.onInstalled.addListener(details => {
  setAdultCookies();
  chrome.alarms.create('comcisScroller', {
    when: Date.now() + 60 * 1000,
    periodInMinutes: 30,
  });
  chrome.storage.local.get(null, item => {
    const merged = { ...initObject, ...(item || {}) };
    merged.version = chrome.runtime.getManifest().version;
    delete merged.udpate;
    chrome.storage.local.set(merged);
    if (details.reason === 'update') {
      chrome.notifications.create('Comics Scroller Update', {
        type: 'basic',
        iconUrl: 'imgs/comics-128.png',
        title: 'Comics Scroller Update',
        message: `Comics Scroller 版本 ${merged.version} 更新`,
      });
    }
  });
});

function handleNavigation(details) {
  if (details.frameId !== 0) return;
  const url = details.url || '';
  if (url.startsWith('chrome-extension://')) return;
  for (const { key, regex, chapterGroup } of SITES) {
    const match = regex.exec(url);
    if (!match) continue;
    chrome.tabs.update(details.tabId, {
      url: `${chrome.runtime.getURL('app.html')}?site=${key}&chapter=${match[chapterGroup]}`,
    });
    return;
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(handleNavigation);

// ----- Subscription polling (dm5 only) -----
// DOMParser isn't available in a service worker, so we regex-scrape the
// landing page rather than reusing dm5Epic's DOM-based scraper.

async function pollDm5(comicsID) {
  const res = await fetch(`https://www.dm5.com/${comicsID}/`, { credentials: 'include' });
  const text = await res.text();
  const chapterList = [];
  const chapters = {};
  const re = /<a[^>]*href="(\/m(\d+)\/)"[^>]*>([^<]+)<\/a>/g;
  let m;
  while ((m = re.exec(text))) {
    const id = `m${m[2]}`;
    if (chapters[id]) continue;
    chapterList.push(id);
    chapters[id] = { title: m[3].trim(), href: `https://www.dm5.com${m[1]}` };
  }
  const titleMatch = /<p[^>]*class="title"[^>]*>([^<]+)<\/p>/.exec(text);
  const coverMatch = /<div class="cover">\s*<img[^>]+src="([^"]+)"/.exec(text);
  return {
    title: titleMatch ? titleMatch[1].trim().split(/\s+/)[0] : '',
    coverURL: coverMatch ? coverMatch[1] : '',
    chapterList,
    chapters,
  };
}

function getStorage() {
  return new Promise(r => chrome.storage.local.get(null, r));
}

function setStorage(value) {
  return new Promise(r => chrome.storage.local.set(value, r));
}

async function comicsQuery() {
  const store = await getStorage();
  if (!store || !Array.isArray(store.subscribe) || store.subscribe.length === 0) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  let updateList = Array.isArray(store.update) ? store.update : [];
  chrome.action.setBadgeText({ text: updateList.length > 0 ? String(updateList.length) : '' });
  for (const { site, comicsID } of store.subscribe) {
    if (site !== 'dm5') continue;
    try {
      const { title, coverURL, chapterList, chapters } = await pollDm5(comicsID);
      const current = store[site] && store[site][comicsID];
      if (!current) continue;
      const newUpdates = chapterList
        .filter(id => !current.chapters[id])
        .map(id => ({
          site,
          chapterID: id,
          comicsID,
          updateChapter: { title: chapters[id].title, href: chapters[id].href },
        }));
      if (newUpdates.length === 0) continue;
      const fresh = await getStorage();
      updateList = [...newUpdates, ...(fresh.update || [])];
      await setStorage({
        ...fresh,
        [site]: {
          ...fresh[site],
          [comicsID]: { ...fresh[site][comicsID], title, chapterList, coverURL, chapters },
        },
        update: updateList,
      });
    } catch (err) {
      console.warn('comicsQuery dm5 error:', err && err.message);
    }
  }
  chrome.action.setBadgeText({ text: updateList.length > 0 ? String(updateList.length) : '' });
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'comcisScroller') comicsQuery();
});
