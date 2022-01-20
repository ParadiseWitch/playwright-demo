import { Stats } from "fs";
import Log from "./log";

const path = require("path");
const fs = require("fs")
export default class FileUtil {
  /**
   * // 判断文件(夹)是否存在
   * @returns 
   */
  public static isExist(path: string): Promise<boolean> {
    return new Promise(function (resolve, reject) {
      fs.access(path, fs.constants.F_OK, (err: Error) => {
        resolve(!err)
      })
    })
  }

  public static read(path: string): Promise<string> {
    return new Promise(async (res, rej) => {
      if (!(await FileUtil.isExist(path))) {
        rej(new Error(`文件不存在：${path}`));
      }
      fs.readFile(path, "utf-8", function (err: Error, data: string) {
        if (err) rej(err);
        res(data);
      });
    })
  }

  public static append(path: string, data: string): Promise<void> {
    return new Promise(async (res, rej) => {
      fs.appendFile(path, data, (err: Error) => {
        if (err) rej(err);
        res();
      });
    })
  }

  public static write(path: string, data: string): Promise<void> {
    return new Promise((res, rej) => {
      fs.writeFile(path, data, (err: Error) => {
        if (err) rej(err);
        res();
      });
    })
  }

  public static mkdir(path: string): Promise<void> {
    return new Promise(async (res, rej) => {
      const isExist = await FileUtil.isExist(path);
      if (isExist) {
        Log.warn(`创建 ${path} 文件夹失败，路径已存在！`);
        res();
      }
      fs.mkdir(path, function (err: Error) {
        if (err) rej(err);
        res();
      })
    })
  }

  public static async isFile(path: string): Promise<boolean> {
    const stats = await FileUtil.getInfo(path)
    return stats.isFile();
  }

  public static getInfo(path: string): Promise<Stats> {
    return new Promise(async (res, rej) => {
      const isExist = await FileUtil.isExist(path);
      if (!isExist) {
        rej(new Error(`${path} 文件/文件夹不存在！`))
      }
      fs.stat(path, (err: Error, stats: Stats) => {
        if (err) rej(err);
        res(stats)
      })
    })
  }

  public static getFiles(path: string): Promise<File[]> {
    return new Promise(async (res, rej) => {
      const isExist = await FileUtil.isExist(path);
      if (!isExist) {
        rej(new Error(`${path} 文件/文件夹不存在！`))
      }
      fs.readdir(path, function (err: Error, files: File[]) {
        if (err) rej(err)
        res(files)
      })
    })
  }
}