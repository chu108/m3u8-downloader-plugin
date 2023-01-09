document.addEventListener("DOMContentLoaded", function () {
    //global
	function __addClass(dom, clz){
		var cln = dom.className.replace(clz, "").trim();
		dom.className = cln ? cln + " " + clz : clz;
	}
	function __removeClass(dom, clz){
		dom.className = dom.className.replace(clz, "").trim();
	}
    function __containsClass(dom, clz){
        return dom.className.indexOf(clz) !== -1;
    }
	
	//show ui
	(function(){
		let _showIds = [
			["monitor-show", "monitor-page"],
			["download-show", "download-page"],
		];
		
		for(let x in _showIds){
			_showIds[x][0] = document.getElementById(_showIds[x][0]);
			_showIds[x][1] = document.getElementById(_showIds[x][1]);
			_showIds[x][0].onclick = showPage;
		}
		
		function showPage(e){
			e.preventDefault();
			e.stopPropagation();

			let include = ["download-show"]
			if (!include.includes(e.target.id)) downLoopClear();

			for(let x in _showIds){
				if(this.id === _showIds[x][0].id){
					__addClass(_showIds[x][0].parentElement, "active");
					__removeClass(_showIds[x][1], "hide");
					__addClass(_showIds[x][1], "show");
				}else{
					__removeClass(_showIds[x][0].parentElement, "active");
					__removeClass(_showIds[x][1], "show");
					__addClass(_showIds[x][1], "hide");
				}
			}
		}
		
	})();

	//monitor - 监控 ----------------------------------------------------------------
	(function(){
		//初始化刷新
		loadMonitoredMedia();
		document.getElementById("monitor-reload").onclick = function(e){
			e.stopPropagation();
			loadMonitoredMedia();
		};
		
		document.getElementById("monitor-clean").onclick = function(e){
			e.stopPropagation();
			cleanMonitoredMedia();
		};

		function cleanMonitoredMedia(){
			chrome.runtime.sendMessage({
				action: "cleanmonitoredmedia"
			}, function(response){
				loadMonitoredMedia();
			});
		}
		//监控-刷新
		function loadMonitoredMedia(){
			var contentDom = document.getElementById("monitor-content");
			contentDom.innerHTML = "......";
			chrome.tabs.query({currentWindow: true, active: true}, (tabs) => {
				console.log("当前URL:", tabs[0].url)
				let tab_url = tabs[0].url;
				chrome.runtime.sendMessage({
					action: "loadmonitoredmedia",
					url: tab_url
				}, function(response){
					let data = response;
					console.log("监控列表:", response)
					console.log("当前url:", window.location.href)
					contentDom.innerHTML = "";
					let dataCount = 0;
					let monitorFilter = document.getElementById("monitor-filter");
					let targetMediaType = monitorFilter[monitorFilter.selectedIndex].value;

					data.sort((a, b)=>{
						return a.duration < b.duration;
					})

					for(let x in data){
						let obj = data[x];
						if(targetMediaType && obj.mediaType !== targetMediaType){
							continue;
						}
						dataCount ++;
						let nameId = "monitor-name-"+x;
						let playlistId = "monitor-playlist-"+x;

						let dom = document.createElement("div");
						let html = (
							'<hr/>' +
							// '<input type="text" data-place="inputFileName" id="' + nameId + '" style="width: 110px;" value="'+obj.url.split("/").pop()+'" />' +
							'<input type="text" data-place="inputFileName" id="' + nameId + '" style="width: 98%;" value="'+obj.tabItem.title+'" />' +
							( obj.duration ? '<span class="badge" data-title="duration">' + MyUtils.formatHms(obj.duration) + '</span>' : '' ) +
							'<span class="badge">' + obj.mediaType + '</span>'
						);
						dom.innerHTML = html;
						dom.style.lineHeight = '30px'

						const isMasterPlaylist = obj.mediaType === "m3u8" && obj.isMasterPlaylist;

						let dom2 = document.createElement("span");
						dom2.innerHTML = '<span class="badge badge-b" data-msg="download">download</span>';
						dom2.dataset["identifier"] = obj.identifier;
						dom2.dataset["url"] = obj.url;
						dom2.dataset["nameId"] = nameId;
						dom2.dataset["playlistId"] = isMasterPlaylist ? playlistId : "";
						dom2.dataset["tab_url"] = tab_url;
						dom2.onclick = downloadMonitoredMedia;

						let dom3 = document.createElement("span");
						dom3.innerHTML = '<span class="badge badge-b" data-msg="delete">delete</span>';
						dom3.dataset["identifier"] = obj.identifier;
						dom3.onclick = deleteMonitoredMedia;

						let dom4 = document.createElement("span");
						dom4.innerHTML = '<span class="badge badge-b" data-msg="copyUrl">copy</span>';
						dom4.dataset["url"] = obj.url;
						dom4.onclick = copyMonitoredUrl;

						contentDom.appendChild(dom);

						if(isMasterPlaylist){
							let dom5 = document.createElement("span");
							const mtSet = new Set();
							const spl = document.createElement("select");
							spl.id = playlistId;
							spl.className = "empty-select";
							for(let r in obj.parseResult.playList){
								let pi = obj.parseResult.playList[r];
								const opt = document.createElement("option");
								opt.value = pi.url;
								opt.text = pi.mediaType + "/" + MyUtils.formatBandwidth(pi.bandwidth);
								opt.dataset["direct"] = pi.isDirect ? String(pi.isDirect) : "";
								spl.appendChild(opt);
								mtSet.add( pi.mediaType );
							}
							spl.dataset["destroy"] = mtSet.size <= 1 ? String(true) : "";
							dom5.appendChild(spl);
							dom.appendChild(dom5);
						}
						dom.appendChild(dom2);
						dom.appendChild(dom3);
						dom.appendChild(dom4);
					}

					if(dataCount === 0){
						contentDom.innerHTML = chrome.i18n.getMessage("nothing");
					}
					document.getElementById("monitor-count").innerHTML = dataCount;
				});
			});

		}

		
		function copyMonitoredUrl(e){
			e.stopPropagation();
			let copyholder = document.getElementById("monitor-copyholder");
			copyholder.value = this.dataset["url"];
			copyholder.select();
			document.execCommand("copy");
		}

		function deleteMonitoredMedia(e){
			e.stopPropagation();
			let identifier = this.dataset["identifier"];
			
			chrome.runtime.sendMessage({
				action: "deletemonitoredmedia",
				data: {
					identifier: identifier
				}
			}, function(response){
				loadMonitoredMedia();
			});
		}
		
		//点击下载按钮
		function downloadMonitoredMedia(e){
			e.stopPropagation();
            let identifier = this.dataset["identifier"];
			console.log("点击下载后，当前数据dataset:", this.dataset);
            let urlMaster = null, destroy = true, isDirect = false;
            if(this.dataset["playlistId"]){
                let spl = document.getElementById(this.dataset["playlistId"]);
                urlMaster = spl[spl.selectedIndex].value;
                destroy = spl.dataset["destroy"] ? true : false;
                isDirect = spl[spl.selectedIndex].dataset["direct"] ? true : false;
            }
            
            let mediaName = document.getElementById(this.dataset["nameId"]).value.trim();
			mediaName = mediaName || MyUtils.getLastPathName( urlMaster || this.dataset["url"] ) || MyUtils.genRandomString();
			console.log("媒体名称:", mediaName);
			let data = {
				identifier: identifier,
				destroy: destroy,
				urlMaster: urlMaster,
				isDirect: isDirect,
				mediaName: MyUtils.escapeFileName(mediaName),
				tabUrl: this.dataset["tab_url"]
			}
			console.log("发送需要下载的媒体:", data);
			chrome.runtime.sendMessage({
				action: "downloadmonitoredmedia",
				data: data
			}, function(response){
				loadMonitoredMedia();
			});
		}
	})();

	let downLoop = null;
	function downLoopClear() {
		if (downLoop != null) {
			clearInterval(downLoop)
			downLoop = null
		}
	}

	//download - 下载 ----------------------------------------------------------------
	(function(){
		downLoopClear();
		//功能tab切换
		(function(){
			let _showIds = [
				["download-downloading-show", "download-downloading-page"],
				["download-batch-show", "download-batch-page"]
			];
			
			for(let x in _showIds){
				_showIds[x][0] = document.getElementById(_showIds[x][0]);
				_showIds[x][1] = document.getElementById(_showIds[x][1]);
				_showIds[x][0].onclick = showPage;
			}
			
			function showPage(e){
				e.preventDefault();
				e.stopPropagation();

				for(let x in _showIds){
					if(this.id === _showIds[x][0].id){
						__addClass(_showIds[x][0], "active");
						__removeClass(_showIds[x][1], "hide");
						__addClass(_showIds[x][1], "show");
					}else{
						__removeClass(_showIds[x][0], "active");
						__removeClass(_showIds[x][1], "show");
						__addClass(_showIds[x][1], "hide");
					}
				}
			}
		})();
		//刷新下载列表
		document.getElementById("download-reload").onclick = function(e){
			e.stopPropagation();
			downLoop = setInterval(()=>{
				if (downLoop === null) {
					downLoopClear();
					return
				}
				chrome.runtime.sendMessage({
					action: "metricdownload"
				}, function(response){
					metricDownloadDownloading(response.downloadingTasks, response.downloadingTasksCustom);
					metricDownloadBatch(response.downloadBatches);
				});
				console.log("downLoop")
			}, 1000);
		}

		//下载 - 批次 - 列表 --------------------------------------------------------------------------
		function metricDownloadBatch(data){
			let contentDom = document.getElementById("download-batch-content");
			contentDom.innerHTML = data.length === 0 ? chrome.i18n.getMessage("nothing") : "";
			document.getElementById("download-batch-count").innerHTML = data.length;
			
			for(let x in data){
				let obj = data[x];
				
				let dom = document.createElement("div");
				let html = (
					'<hr/>' +
					'<span class="badge badge-name" data-title="downloadDatchName">' + obj.showName.substring(0, 30) + '</span>' +
					'<span class="badge" data-title="downloadTaskCompletedCnt">' + obj.completedCnt + '</span>' +
					'<span class="badge" data-title="downloadTaskSum">' + obj.sum + '</span>'
				);
				dom.innerHTML = html;
				contentDom.appendChild(dom);
			}
		}
		//下载 - 正在下载的任务 ----------------------------------------------------------------------------------
		function metricDownloadDownloading(data, custom){
			let contentDom = document.getElementById("download-downloading-content");
			contentDom.innerHTML = data.length === 0 ? chrome.i18n.getMessage("nothing") : "";
			document.getElementById("download-downloading-count").innerHTML = data.length;
			
			for(let x in data){
				let obj = data[x];
				console.log("正在下载记录:", MyUtils.isChromeTarget(obj.id), "id:", obj.id);
                if(MyUtils.isChromeTarget(obj.id)){
                    metricDownloadDownloadingChrome(contentDom, obj);
                }else{
                    metricDownloadDownloadingCustom(contentDom, obj, custom);
                }
			}
		}
        
        function metricDownloadDownloadingChrome(contentDom, obj){
            let dom = document.createElement("div");
            let html = '<hr/><span class="badge badge-name" data-title="fileName">' + obj.fileName + '</span>';
            dom.innerHTML = html;
            
            let dom2 = document.createElement("span");
            dom2.innerHTML = '<span class="badge badge-b" data-msg="cancel">cancel</span>';
            dom2.dataset["downloadId"] = obj.id;
            dom2.addEventListener("click", cancelDownload);
            
            contentDom.appendChild(dom);
            dom.appendChild(dom2);
            
            if(obj.canResume){
                let dom3 = document.createElement("span");
                dom3.innerHTML = '<span class="badge badge-b" data-msg="resume">resume</span>';
                dom3.dataset["downloadId"] = obj.id;
                dom3.addEventListener("click", resumeDownload);
                
                dom.appendChild(dom3);
            }
            
            let dom4 = document.createElement("span");
            dom4.innerHTML = '<span class="badge badge-b" data-msg="copyUrl">copyUrl</span>';
            dom4.dataset["url"] = obj.url;
            dom4.onclick = copyDownloadUrl;
            dom.appendChild(dom4);
        }
        
		function cancelDownload(e){
			e.stopPropagation();
			let downloadId = parseInt(this.dataset["downloadId"], 10);
			chrome.runtime.sendMessage({
				action: "canceldownload",
				data: {
					id: downloadId
				}
			}, function(response){
			});
            this.removeEventListener("click", cancelDownload);
		}
		
		function resumeDownload(e){
			e.stopPropagation();
			let downloadId = parseInt(this.dataset["downloadId"], 10);
			chrome.runtime.sendMessage({
				action: "resumedownload",
				data: {
					id: downloadId
				}
			}, function(response){
			});
            this.removeEventListener("click", resumeDownload);
		}
        
		function copyDownloadUrl(e){
			e.stopPropagation();
			let copyholder = document.getElementById("download-copyholder");
			copyholder.value = this.dataset["url"];
			copyholder.select();
			document.execCommand("copy");
		}
		
        
        function buildOperationalDom(data, msg){
            const dom = document.createElement("span");
            dom.innerHTML = '<span class="badge badge-b" data-msg="' + msg + '">' +  msg + '</span>';
            const onceClickHandler = function(e){
                e.stopPropagation();
                chrome.runtime.sendMessage({
                    action: "download." + msg,
                    data: {
                        id: data.id
                    }
                }, function(response){
                });
                dom.removeEventListener("click", onceClickHandler);
            };
            dom.addEventListener("click", onceClickHandler);
            return dom;
        }
    
        function metricDownloadDownloadingCustom(contentDom, obj, custom){
            const data = custom[obj.id];
            const itemDom = document.createElement("div");
            itemDom.innerHTML = '<hr/><div>' + data.url + '</div>';
            const statusDom = document.createElement("div");
            const progressDom1 = document.createElement("div");
            progressDom1.className = "download-progress-outer";
            const progressDom2 = document.createElement("div");
            progressDom2.className = "download-progress-inner";
            const operationDom = document.createElement("div");
            const pauseDom = buildOperationalDom(data, "pause");
            const resumeDom = buildOperationalDom(data, "resume");
            const restartDom = buildOperationalDom(data, "restart");
            const cancelDom = buildOperationalDom(data, "cancel");
            
            contentDom.appendChild(itemDom);
            itemDom.appendChild(statusDom);
            itemDom.appendChild(progressDom1);
            progressDom1.appendChild(progressDom2);
            itemDom.appendChild(operationDom);
            operationDom.appendChild(pauseDom);
            operationDom.appendChild(resumeDom);
            operationDom.appendChild(restartDom);
            operationDom.appendChild(cancelDom);
            
            if(data.state === "in_progress"){
                statusDom.innerText = data.speed + ' ' + data.speedUnit + ' - ' + data.loaded + ' B' + ( data.lengthComputable ? ' , '+chrome.i18n.getMessage("downloadTotal")+' ' + data.total + ' B' + (data.remainSec >= 0 ? ' , '+chrome.i18n.getMessage("downloadRemaining")+' ' + data.remainSec  + ' '+chrome.i18n.getMessage("second") : '') : '' );
                statusDom.style.display = "block";
                if(data.lengthComputable){
                    progressDom2.style.width = data.percent + "%";
                    progressDom1.style.display = "block";
                }else{
                    progressDom1.style.display = "none";
                }
                cancelDom.style.display = "block";
                resumeDom.style.display = "none";
                if(data.restart){
                    pauseDom.style.display = "none";
                    restartDom.style.display = "block";
                }else{
                    pauseDom.style.display = data.resumable ? "block" : "none";
                    restartDom.style.display = "none";
                }
            }else if(data.state === "interrupted"){
                statusDom.innerText = data.loaded + ' B' + ( data.lengthComputable ? ' , '+chrome.i18n.getMessage("downloadTotal")+' ' + data.total + ' B' : '' ) + ' , '+chrome.i18n.getMessage("downloadError");
                statusDom.style.display = "block";
                progressDom1.style.display = "none";
                pauseDom.style.display = "none";
                cancelDom.style.display = "block";
                if(data.restart){
                    resumeDom.style.display = "none";
                    restartDom.style.display = "block";
                }else{
                    resumeDom.style.display = data.resumable ? "block" : "none";
                    restartDom.style.display = !data.resumable ? "block" : "none";
                }
            }else if(data.state === "complete"){
                statusDom.style.display = "none";
                progressDom1.style.display = "none";
                pauseDom.style.display = "none";
                cancelDom.style.display = "none";
                resumeDom.style.display = "none";
                restartDom.style.display = "none";
            }
        }
	})();

	//i18n - 语言切换 ----------------------------------------------------------------
	(function(){
		
		document.title = chrome.i18n.getMessage("appName");
	
		function setupI18n(root){
			
			function setup(dom){
				if(dom.dataset != null){
					if(dom.dataset["title"]){
						dom.title = chrome.i18n.getMessage( dom.dataset["title"] );
					}
                    if(dom.dataset["msg"]){
						dom.innerHTML = chrome.i18n.getMessage( dom.dataset["msg"] );
					}
                    if(dom.dataset["place"]){
						dom.placeholder = chrome.i18n.getMessage( dom.dataset["place"] );
					}
				}
			}
			
			root.querySelectorAll("[data-msg] , [data-title] , [data-place]").forEach(function(dom){
				setup(dom);
			});
			
			setup(root);
		}
		
		setupI18n(document);
		
		let observer = new MutationObserver(function(mutationList){
			mutationList.forEach((mutation) => {
			    switch (mutation.type) {
			    case "childList":
					mutation.addedNodes.forEach((node) => {
						if(node.tagName && node.dataset){
							setupI18n(node);
						}
					});
			        break;
				default:
					break;
			    }
			});
		});
		
		observer.observe(document, {
			subtree: true,
			childList: true
		});
		
	})();
	
});
