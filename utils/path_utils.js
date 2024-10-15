const path = require('path');

function getAppPath() {
    if(process.env.NODE_ENV === "development"){
        return process.cwd();
    }else if(process.env.NODE_ENV === "production"){
        return process.cwd();
    }else{
        console.error("未知的Node环境,不能返回APP所在的路径", process.env.NODE_ENV)
        return null;
    }
}


function getAppResourcePath(devPaths, prodPaths){
    return path.join(getAppPath(),
        process.env.NODE_ENV === "development" ? devPaths : "",
        process.env.NODE_ENV === "production" ? prodPaths : "",
    )
}

module.exports = {  
    getAppPath,  
    getAppResourcePath
};