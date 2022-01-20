import { Browser, chromium, ElementHandle, Page } from 'playwright';
import Log from "../utils/log"
import download from '../utils/download';
import FileUtil from '../utils/FileUtil';
import to, { toRet } from '../utils/to';


interface Chapter {
  // index: number,
  url: string,
  title: string,
}

(async () => {
  let browser: Browser;
  let comic_title: string;
  const host = 'https://www.copymanga.com';
  const router = 'zgmsbywt'
  const targetUrl = `${host}/comic/${router}`
  let chapters: Chapter[]
  try {
    // browser = await chromium.launchPersistentContext(
    //   "C:\\Users\\admin\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\",
    //   {
    //     executablePath:
    //       "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    //     // executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    //     // headless: true,
    //   }
    // );
    browser = await chromium.launch({ headless: false, slowMo: 100});
    // browser = await chromium.launch();
    const page = await browser.newPage()
    page.setDefaultNavigationTimeout(30000)
    const navigationPromise = page.waitForNavigation()
    // await navigationPromise;
    await page.goto(targetUrl, {
      waitUntil: "load",
      timeout: 30000
    });
    await page.setViewportSize({ width: 1920, height: 1080 })

    chapters = (await page.$$eval<Chapter[], HTMLElement>(
      '#default全部 ul:first-child a',
      (els): Chapter[] => els.map((el): Chapter => {
        return {
          url: el.getAttribute('href'),
          title: el.textContent
        }
      })
    )).map(item => {
      return {
        url: host + item.url,
        title: item.title
      }
    });

    comic_title = await page.$eval('.row > .col-9 > ul > li > h6', el => el.textContent);

    await toRet(FileUtil.mkdir(`./caputer/${comic_title}`))
    Log.log(`章节长度: ${chapters.length}`);
  } catch (e) {
    Log.error(e);
    await browser.close();
  }
  // goto章节链接 循环章节
  await goToChaptersAndDownload(chapters, comic_title, browser);

  // } catch (error) {
  //   Log.error(`${comic_title} 爬取失败！`, error);
  // } finally {
  await browser.close()
  // }
})();



async function goToComicPageAndGetImgs(page: Page, url: string): Promise<string[]> {
  // page.setDefaultNavigationTimeout(30000)
  // await page.waitForNavigation()
  await page.goto(url)
  await page.setViewportSize({ width: 500, height: 637 })

  const [waitErr,] = await to(page.waitForSelector('body > div > .comicCount'))
  if (waitErr) {
    throw new Error(`等待元素：'body > div > .comicCount' 显示超时！${waitErr}`);
  }
  const comicCount = await (await page.$('body > div > .comicCount')).textContent();
  Log.log(`本话共有 ${comicCount} 页`);

  await page.waitForSelector('.container-fluid > .container > .comicContent-list')
  const scrollToBottom = async () => {
    // await lastItemRendered.scrollIntoViewIfNeeded();
    await page.keyboard.press("PageDown");
    await page.waitForTimeout(100);
    const comicIndex = await (await page.$('body > div > .comicIndex')).textContent();
    if (comicCount === comicIndex) {
      Log.log(`最后的漫画页数： ${comicIndex}`);
      return;
    };
    await scrollToBottom();
  };
  await scrollToBottom();

  const imgSrcs = await page.$$eval(
    '.container-fluid > .container > .comicContent-list > li > img',
    els => els.map(el => el.getAttribute('data-src'))
  )

  // const items = await page.$$('.container-fluid > .container > .comicContent-list');
  // const lastItemRendered = items[items.length - 1];
  // 等到图片加载完毕后截图
  // let complete;
  // await page.waitForFunction((complete) => {
  //   const lastImg = document.querySelector('.container-fluid > .container > .comicContent-list > li:nth-last-child(1) > img');
  //   complete = (lastImg as HTMLImageElement).complete;
  //   return (lastImg as HTMLImageElement).complete;
  // }, complete, {timeout:30000});
  // Log.log(`${complete}`);
  // await lastItemRendered.screenshot({path: './caputer/comic.png'});

  return imgSrcs;
}


// TODO 封装成参数为：章节url数组,comic_title，browser
// chapter_title 去章节拿
const goToChaptersAndDownload = async (chapters: Chapter[], comic_title: string, browser: Browser) => {
  for (let index = 0; index < chapters.length; index++) {
    let imgsSrc: string[];
    let chapter_title: string =  chapters[index].title;
    const chapter_link = chapters[index].url;
    let subPage: Page;
    try {
      subPage = await browser.newPage()
      // await navigationPromise

      Log.log(`开始下载《${chapter_title}》的图片, 链接：${chapter_link} `);

      const chapterIsExist = await FileUtil.isExist(`./caputer/${comic_title}/${chapter_title}`);
      if (chapterIsExist) {
        const files = await toRet(FileUtil.getFiles(`./caputer/${comic_title}/${chapter_title}`));
        if (files && files.length !== 0) {
          Log.info(`./caputer/${comic_title}/${chapter_title} 该文件夹下已有文件，跳过下载`)
          continue;
        }
      }
      await FileUtil.mkdir(`./caputer/${comic_title}/${chapter_title}`)

      imgsSrc = await goToComicPageAndGetImgs(subPage, chapter_link);
      await subPage.close();

      // 防止被ban
      // await page.waitForTimeout(1000);

    } catch (error) {
      Log.error(`${comic_title} ${chapter_title} 爬取图片失败。`, error);
      subPage.close;
      continue;
    }

    try {
      // 循环图片
      for (let imgIndex = 0; imgIndex < imgsSrc.length; imgIndex++) {
        const link = imgsSrc[imgIndex];
        download(link, `./caputer/${comic_title}/${chapter_title}/第${imgIndex + 1}页.png`)
      }
    } catch (e) {
      Log.error(`${comic_title} ${chapter_title} 爬取图片失败，本话的图片:\n${imgsSrc.join('\n')}`, e)
      continue;
    }
  }
}
