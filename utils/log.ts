import { dateFormat } from './DateUtil'
import FileUtil from "./FileUtil";
const chalk = require('chalk')

export default class Log {
  private static logPath = './log/';
  private static logName = 'log.txt';
  public static log(...contents: string[]) {
    Log.writeLogFile("info", ...contents);
    console.log(chalk.rgb(149, 176, 181).bold.bgRgb(40, 44, 52)(contents.join('\n')));
  }
  public static debug(...contents: string[]) {
    Log.writeLogFile("debug", ...contents);
    console.log(chalk.rgb(83, 166, 121).bold.bgRgb(40, 44, 52)(contents.join('\n')));
  }
  public static error(...contents: any[]) {
    const newContents =  contents.map(item => {
      if (item instanceof Error) {
        return item.message + '\n' + item.stack;
      }
    })
    Log.writeLogFile("error", ...newContents);
    console.log(chalk.rgb(218, 106, 117).bold.bgRgb(40, 44, 52)(newContents.join('\n')));
  }
  public static warn(...contents: string[]) {
    Log.writeLogFile("warn", ...contents);
    console.log(chalk.rgb(198, 192, 111).bold.bgRgb(40, 44, 52)(contents.join('\n')));
  }
  public static info(...contents: string[]) {
    Log.log(...contents);
  }

  public static async writeLogFile(level: string, ...contents: string[]) {
    const logFilePath = this.logPath + level + '.txt';
    const isExist = await FileUtil.isExist(logFilePath);
    if (!isExist) {
      FileUtil.write(logFilePath,'').catch(err => console.error(`创建文件${logFilePath}失败！${err}`))
    }
    const now = dateFormat(new Date());
    const newLine = `[${level}]\t${now}\t | ${contents.join(", ")}\n`;
    FileUtil.append(logFilePath, newLine)
      .catch(err => console.log(`记录日志失败,${err}`))
  }
}