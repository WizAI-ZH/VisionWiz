// 版权所有 (C) [2024] [珠海威智人工智能有限公司]  
// 根据GPLv3或更高版本的条款进行许可  
// 请参阅LICENSE文件以获取详细信息

const fs = require("fs");
const path = require("path");
/**
 * 查找指定目录下包含特定字眼的文件名
 * @param {string} dir 要搜索的目录路径
 * @param {string} searchString 文件名中要查找的字眼
 */
function findFilesWithSubstring(dir, searchString) {
  try {
    // 使用同步方法读取目录内容
    const files = fs.readdirSync(dir);

    // 过滤出包含指定字眼的文件
    return files.filter(file => file.includes(searchString));
  } catch (err) {
    console.error('无法扫描目录：' + err);
    return [];
  }
}

/**
 * 查找指定目录并且删除目录内的所有内容及其本身
 * @param {string} path 要删除的目录路径
 */
function delDirRecurse(path) {
  //删除当前路径所有文件夹及其子文件夹
  let files = [];
  console.log(path)
  if (fs.existsSync(path)) {
    files = fs.readdirSync(path);
    files.forEach(function (file, index) {
      let curPath = path + "/" + file;
      if (fs.statSync(curPath).isDirectory()) { // recurse
        delDirRecurse(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};


/**
 * 查找指定目录并且删除目录内的所有内容
 * @param {string} dir 要删除内容的目录路径
 */
function delDirContents(dir) {  
      // 读取目录中的所有文件和子目录  
      if (fs.existsSync(dir)) {  
        const files = fs.readdirSync(dir);  
        // 遍历每个文件和子目录  
        files.forEach(file => {  
            const filePath = path.join(dir, file);  
            // 检查文件类型  
            const stats = fs.statSync(filePath);  
            if (stats.isDirectory()) {  
                // 如果是目录，递归删除其内容  
                deleteDirectoryContents(filePath);  

                // 删除空目录  
                fs.rmdirSync(filePath);  
            } else {  
                // 如果是文件，删除文件  
                fs.unlinkSync(filePath);  
            }  
        });  
    }  
}  

module.exports = { findFilesWithSubstring, delDirRecurse, delDirContents }