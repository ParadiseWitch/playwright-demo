import { Browser, chromium, ElementHandle, Page } from 'playwright';
import Log from "./utils/log"
import { download } from './utils/AxiosUtil';
import FileUtil from './utils/FileUtil';
import { Chapter } from './types/type';
import to, { toRet } from './utils/to';


const bootstraps = async () => {
  let browser: Browser;
  let comic_title: string;
  const host = 'https://www.copymanga.com';
  const router = 'zgmsbywt'
  const targetUrl = `${host}/comic/${router}`
  let chapters: Chapter[]
  let page: Page;
  ({ browser, page } = await initBrowserAndPage(browser, page));
  // await page.waitForNavigation();

  // TODO: 健康检查
  // 1. 请求漫画页面
  toRet(page.goto(targetUrl, { waitUntil: "load", timeout: 30000 }), `请求超时！网站可能暂时无法访问！${targetUrl} `, async () => { await browser.close(); });

  // 2. 获取漫画名
  comic_title = await toRet(page.$eval('.row > .col-9 > ul > li > h6', el => el.textContent), `获取漫画名失败！`, async () => { await browser.close(); });

  // 3. 构建漫画章节数组
  try {
    chapters = (await page.$$eval<Chapter[], HTMLElement>(
      '#default全部 ul:first-child a',
      (els): Chapter[] => els.map((el): Chapter => {
        return {
          url: host + el.getAttribute('href'),
          title: el.textContent
        }
      })
    ))
  }
  catch (e) {
    Log.error(`获取章节列表失败！${e}`);
    await browser.close();
  }
  Log.log(`章节长度: ${chapters.length}`);

  // 4. 创建漫画名文件夹 
  await toRet(FileUtil.mkdir(`./caputer/${comic_title}`), `创建漫画文件夹失败：./caputer/${comic_title}`, async () => { await browser.close(); });

  // 5. goto每个章节链接 循环章节 下载图片
  await toRet(goToChaptersAndDownload(chapters, comic_title, browser), `下载失败！`, async () => { await browser.close(); });
  await browser.close()
}



/**
 * 初始化浏览器和page 
 * @param browser 
 * @param page 
 * @returns {Promise<{browser: Browser, page: Page}>}
 */
async function initBrowserAndPage(browser: Browser, page: Page) {
  try {
    browser = await chromium.launch();
    page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    await page.setViewportSize({ width: 1920, height: 1080 });
  } catch (e) {
    Log.error(e);
    await browser.close();
  }
  return { browser, page };
}




/**
 * 循环每个章节链接，下载获取到的图片链接
 * TODO 拆解成几个模块，职责明确
 * @param chapters 章节数组
 * @param comic_title 漫画名
 * @param browser 
 */
const goToChaptersAndDownload = async (chapters: Chapter[], comic_title: string, browser: Browser) => {
  for (let index = 0; index < chapters.length; index++) {
    let imgs: string[];
    let chapter_title: string = chapters[index].title;
    const chapter_link = chapters[index].url;
    try {
      // await navigationPromise
      Log.log(`开始下载《${chapter_title}》的图片, 链接：${chapter_link} `);

      // TODO:更新策略
      const chapterIsExist = await FileUtil.isExist(`./caputer/${comic_title}/${chapter_title}`);
      if (chapterIsExist) {
        const files = await toRet(FileUtil.getFiles(`./caputer/${comic_title}/${chapter_title}`));
        if (files && files.length !== 0) {
          Log.info(`./caputer/${comic_title}/${chapter_title} 该文件夹下已有文件，跳过下载`)
          continue;
        }
      }
      await FileUtil.mkdir(`./caputer/${comic_title}/${chapter_title}`)

      imgs = await goToComicPageAndGetImgs(browser, chapter_link);

      // 防止被ban
      // await page.waitForTimeout(1000);
    } catch (error) {
      Log.error(`${comic_title} ${chapter_title} 爬取图片失败。`, error);
      continue;
    }

    try {
      // 循环图片
      for (let imgIndex = 0; imgIndex < imgs.length; imgIndex++) {
        const link = imgs[imgIndex]
        download(link, `./caputer/${comic_title}/${chapter_title}/第${imgIndex + 1}页.png`)
      }
    } catch (e) {
      Log.error(`${comic_title} ${chapter_title} 下载图片链接失败，本话的图片:\n${imgs.join('\n')}`, e)
      continue;
    }
  }
}


/**
 * 去指定的章节链接，获取图片链接
 * @param page 
 * @param url 
 * @returns 
 */
async function goToComicPageAndGetImgs(browser: Browser, url: string): Promise<string[]> {
  // page.setDefaultNavigationTimeout(30000)
  // await page.waitForNavigation()
  const page: Page = await browser.newPage()
  let imgs: string[];
  try {
    // 1. 跳转章节链接
    await toRet(page.goto(url), `加载章节失败：${url}`, async () => { throw new Error(`加载章节失败：${url}`) });
    await page.setViewportSize({ width: 500, height: 637 })

    // 2. 等待漫画页数的Dom节点加载
    await toRet(page.waitForSelector('body > div > .comicCount'), `等待元素：'body > div > .comicCount' 显示超时！`, async () => { throw new Error(`加载网页可能失败，漫画页数指示器未加载`) })
    const comicCount = await (await page.$('body > div > .comicCount')).textContent();
    Log.log(`本话共有 ${comicCount} 页`);

    // 3. 等待漫画内容容器的Dom节点加载
    await toRet(page.waitForSelector('.container-fluid > .container > .comicContent-list'), `等待元素：'.container-fluid > .container > .comicContent-list' 显示超时！`, async () => { throw new Error(`加载网页可能失败，漫画内容的容器未加载`) })
    
    // 4. 滚动到底部，触发图片加载
    const scrollToBottom = async () => {
      await page.keyboard.press("PageDown");
      await page.waitForTimeout(100);
      // 默认如果漫画页数的Dom节点，那么这个节点也会加载
      const comicIndex = await (await page.$('body > div > .comicIndex')).textContent();
      if (comicCount === comicIndex) {
        Log.log(`最后的漫画页数： ${comicIndex}`);
        return;
      };
      await scrollToBottom();
    };
    await scrollToBottom();

    // 5. 获取图片链接
    imgs = await page.$$eval(
      '.container-fluid > .container > .comicContent-list > li > img',
      els => els.map(el => el.getAttribute('data-src'))
    )
    return imgs;
  } catch (error) {
    Log.error(`获取图片链接失败: ${url}`, error);
    await page.close();
  }
  

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

}


bootstraps();