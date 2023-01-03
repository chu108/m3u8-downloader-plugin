var MyBootstrap = (function () {
	if (document.readyState == "interactive") {
		_start();
	} else {
		document.addEventListener("DOMContentLoaded", _start);
	}

	function _start() {
		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			if(request.action == "downloadmedia"){
                if(MyDownload.canDownload()){
                    _downloadMedia(request.data);
                }
				sendResponse({success: true});
			}else if(request.action == "loadmonitoredmedia"){
				sendResponse(MyChromeMediaMonitor.view());
			}else if(request.action == "downloadmonitoredmedia"){
                if(!MyDownload.canDownload()){
                    sendResponse({success: true});
                    return ;
                }
                console.log("1.request:", request, "request.data:", request.data);
				var mediaItem = request.data.destroy ? MyChromeMediaMonitor.take(request.data.identifier) : MyChromeMediaMonitor.element(request.data.identifier);
                console.log("mediaItem:", mediaItem);
                if(request.data.urlMaster){
                    mediaItem.url = request.data.urlMaster;
                    mediaItem.parseResult = null;
                }
                if(request.data.isDirect){
                    mediaItem.mediaType = "video";
                }
				sendResponse({success: true});
                let data = { mediaItem: mediaItem, mediaName: request.data.mediaName }
                console.log("2._downloadMonitoredMedia.data:", data);
				_downloadMonitoredMedia(data);
			}else if(request.action == "deletemonitoredmedia"){
				MyChromeMediaMonitor.take(request.data.identifier);
				sendResponse({success: true});
			}else if(request.action == "metricdownload"){
                const metric = MyDownload.metric();
                metric.downloadingTasksCustom = MyM3u8Processer.downloadMetric();
                sendResponse(metric);
			}else if(request.action == "canceldownload" || request.action == "download.cancel"){
				MyDownload.cancel(request.data.id);
				sendResponse({success: true});
			}else if(request.action == "resumedownload"){
				MyChromeDownload.resume(request.data.id);
				sendResponse({success: true});
			}else if(request.action == "getconfig"){
				sendResponse(MyChromeConfig.view());
			}else if(request.action == "updateconfig"){
				MyChromeConfig.update(request.data);
				sendResponse({success: true});
			}else if(request.action == "cleanmonitoredmedia"){
				MyChromeMediaMonitor.clear();
				sendResponse({success: true});
			}else if(request.action == "loadrunninginfo"){
                sendResponse({
                    monitor: MyChromeMediaMonitor.info(),
                    videox: MyVideox.info(),
                    download: MyDownload.info(),
                    notification: MyChromeNotification.info(),
                    processer: MyM3u8Processer.info(),
                    matchingRule: MyUrlRuleMatcher.info()
                });
			}else if(request.action == "download.resume"){
                MyM3u8Processer.downloadResume(request.data.id);
                sendResponse({success: true});
			}else if(request.action == "download.restart"){
                MyM3u8Processer.downloadRestart(request.data.id);
                sendResponse({success: true});
			}else if(request.action == "download.pause"){
                MyM3u8Processer.downloadPause(request.data.id);
                sendResponse({success: true});
			}else if(request.action == "contentscript.match"){
                const matcherResult = MyUrlRuleMatcher.matchAndParse( request.data.url, "contentscript" );
                sendResponse({ content: (matcherResult != null && matcherResult.targetContentscript != null) ? matcherResult.targetContentscript.func : null });
			}else if(request.action == "contentscript.setm3u8"){
                MyChromeMediaMonitor.add(request.data.url, "GET", request.data.result);
                sendResponse({success: true});
			}
			
		});
		
		
		
		chrome.browserAction.onClicked.addListener(function(tab) {
			chrome.tabs.create({
				url: chrome.extension.getURL("popup/index.html")
			}, function(){});
		});
        
        
        _updateIcon(! MyChromeMediaMonitor.isEmpty() );
	}
	
	
	function _downloadMedia(data){
		var toSend = {
			reqConfig: {
				url: data.url,
				method: data.method,
                headers: MyHttpHeadersHandler.filterForbidden( MyHttpHeadersHandler.filter(data.headers) )
			}, 
			mediaName: data.mediaName
		};
		if(data.mediaType == "m3u8"){
			_downloadM3u8(toSend);
		}else{
			_downloadOther(toSend);
		}
	}
	
	
	function _downloadMonitoredMedia(data){
		if(data == null || data.mediaItem == null){
			return ;
		}
		var toSend = {
			reqConfig: {
				url: data.mediaItem.url,
				method: data.mediaItem.method,
                headers: MyHttpHeadersHandler.filterForbidden(data.mediaItem.requestData ? data.mediaItem.requestData.requestHeaders : null)
			}, 
			mediaName: data.mediaName
		};
        console.log("3.toSend:", toSend, "data.mediaItem:", data.mediaItem)
		if(data.mediaItem.mediaType == "m3u8"){
			_downloadM3u8(toSend, data.mediaItem.parseResult);
		}else{
			_downloadOther(toSend);
		}
	}
	
	function _downloadM3u8(data, parseResult){
        console.log("4._downloadM3u8.data:", data, "parseResult:", parseResult)
		if(parseResult == null){
            MyVideox.getInfo("m3u8", data.reqConfig.url, data.reqConfig.method, data.reqConfig.url, data.reqConfig.headers, function(result){
                if(result == null){
					return ;
				}
                _downloadM3u8CustomImpl(data, result);
            });
		}else{
			_downloadM3u8CustomImpl(data, parseResult);

		}
	}
	
    
    function _downloadM3u8CustomImpl(data, parseResult){
        if(parseResult.isMasterPlaylist){
            return ;
        }
        console.log("5._downloadM3u8CustomImpl.data:", data, "parseResult:", parseResult)
        const uniqueKey = MyUtils.genRandomString();
		const downloadDirectory = chrome.i18n.getMessage("appName") + "-" + uniqueKey;
        console.log("6.uniqueKey:", uniqueKey, "downloadDirectory:", downloadDirectory)
        let loadData = {
            id: uniqueKey,
            downloadDirectory: downloadDirectory,
            parseResult: parseResult,
            completedCnt: 0,
            total: 0,
            chromeM3u8 : {
                data : {
                    uniqueKey: uniqueKey,
                    downloadDirectory: downloadDirectory,
                    reqConfig: data.reqConfig,
                    mediaName: data.mediaName
                },
                threshold: MyChromeConfig.get("processerThreshold") * 1024 * 1024,
                basic: false,
                processerId: null,
                index: 0,
                completedCnt: 0
            },
            mediaName: data.mediaName,
            mergeCallback: mergeCallback
        }
        console.log("7.loadData:", loadData)
        MyM3u8Processer.saveDownloadContext(loadData);
        stepDownloadKey();
        
        function stepDownloadKey(){
            if(parseResult.keyData.size == 0){
                stepDownloadTs();
                return ;
            }
            const tasks = [];
            parseResult.keyData.forEach(function(key, keyRef){
                tasks.push({
                    options: {
                        url: key.url,
                        filename: downloadDirectory + "/custom/key-" + keyRef,
                        method: data.reqConfig.method
                    },
                    target: "custom",
                    custom: { phase: "key", contextId: uniqueKey, keyRef: keyRef }
                });
            });
            console.log("8.tasks:", tasks, "showName:", data.mediaName + ".multiplekey", "stepDownloadTs:", stepDownloadTs)
            MyDownload.download({
                tasks: tasks, 
                showName: data.mediaName + ".multiplekey"
            }, stepDownloadTs);
        }
        
        function stepDownloadTs(){
            const tasks = [];
            for(let x in parseResult.playList){
                tasks.push({
                    options: {
                        url: parseResult.playList[x].url,
                        filename: downloadDirectory + "/custom/ts-" + x,
                        method: data.reqConfig.method
                    },
                    target: "custom",
                    custom: { phase: "ts", contextId: uniqueKey, index: x }
                });
            }
            
            MyDownload.download({
                tasks: tasks, 
                showName: data.mediaName + ".multiplets"
            }, null);
        }
        
        function mergeCallback(){
            if(MyChromeConfig.get("playSoundWhenComplete") == "1"){
                MyVideox.play( chrome.extension.getURL("complete.mp3") );
            }
        }
        
    }
	
    
	function _downloadOther(data){
		var downloadDirectory = chrome.i18n.getMessage("appName") + "-" + MyUtils.genRandomString();
		downloadDirectory = MyChromeConfig.get("newFolderAtRoot") == "0" ? "" : downloadDirectory + "/";

		var suffix = MyUtils.getSuffix(data.mediaName, false);
		if(suffix){
			suffix = "";
		}else{
			suffix = MyUtils.getSuffix(data.reqConfig.url, true);
			suffix = suffix ? "."+suffix : "";
		}
		
		MyDownload.download({
            tasks: [{
                options: {
                    url: data.reqConfig.url,
                    filename: downloadDirectory + data.mediaName + suffix,
                    method: data.reqConfig.method,
                    headers: data.reqConfig.headers
                },
                target: "chrome"
            }], 
            showName: data.mediaName + suffix
        }, function(){
			if(MyChromeConfig.get("playSoundWhenComplete") == "1"){
				MyVideox.play( chrome.extension.getURL("complete.mp3") );
			}
		});
		
	}
	
	
	function _updateIcon(marked){
		chrome.browserAction.setIcon({
			path: chrome.extension.getURL("img/icon128" + (marked ? "marked" : "") + ".png")
		});
	}
	
	
	return {
		updateIcon: _updateIcon
	}
})();