const modal = document.getElementById("myModal");
const span = document.getElementsByClassName("close")[0];
const modalText = document.getElementById("modal-text");
const captureBtn = document.getElementById('capture-btn');
const namePtrn = /Course:\s+"([^"]+)"/;

var video;
var selecting = false;
var startPoint = {
    x: 0,
    y: 0
};
var endPoint = {
    x: 0,
    y: 0
};

var selection = null;
var courseName = materials[0].video.description.match(namePtrn)[1];
var lo = "";
lo = materials[0].video.learningObjs[0];

span.onclick = function () {
    modal.style.display = "none";
}
// window.onclick = function (event) {
//     if (event.target == modal) {
//         modal.style.display = "none";
//     }
// }

async function getSearchResult(text, userID, lo, courseName, searchMode) {
    const lmScore = Number(searchMode);
    try {
        const response = await fetch("https://curio.oli.cmu.edu/videos/search", {
            method: "POST",
            body: new URLSearchParams({ text, userID, lo, courseName, lmScore })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status
                }`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error:', error);
    }
}

function initPlayer(material) {
    const title = document.getElementById('courseTitle');
    title.innerText = material.video.title.replaceAll('_', ' ');

    const player = document.createElement('video');
    player.setAttribute('id', 'my-video');
    player.setAttribute('class', 'video-js');
    player.setAttribute('crossorigin', 'anonymous');
    // Available attrs: https://videojs.com/guides/options
    player.setAttribute(
        'data-setup',
        `{
            "preload": "metadata",
            "controls": "controls",
            "width": "1280",
            "height": "720",
            "userActions": {
                "click": false
            }
        }`
    );
    console.log(material.video.filename);
    // Remove https://curio.oli.cmu.edu/ in production env.
    player.innerHTML = `
        <source src="https://curio.oli.cmu.edu/${material.video.filename}" type="video/mp4">
        <track kind="captions" src="https://curio.oli.cmu.edu/${material.video.captionFile}" srclang="en" label="English" default>
    `
    document.body.insertBefore(player, document.body.firstChild);
    return player
}

function startSelection(e) {
    selecting = true;
    startPoint = {
        x: e.offsetX,
        y: e.offsetY
    };
    // Create selection element
    selection = document.createElement('div');
    selection.className = 'selection';
    selection.style.left = `${startPoint.x}px`;
    selection.style.top = `${startPoint.y}px`;
    document.body.appendChild(selection);
}

function updateSelection(e) {
    if (!selecting || !selection)
        return;

    endPoint = {
        x: e.offsetX,
        y: e.offsetY
    };
    // Calculate left and top for the selection
    const left = Math.min(startPoint.x, endPoint.x);
    const top = Math.min(startPoint.y, endPoint.y);
    // Update selection element
    selection.style.width = `${Math.abs(endPoint.x - startPoint.x)}px`;
    selection.style.height = `${Math.abs(endPoint.y - startPoint.y)}px`;
    selection.style.left = `${left}px`;
    selection.style.top = `${top}px`;
}

function stopSelection(e) {
    selecting = false;
    endPoint = {
        x: e.offsetX,
        y: e.offsetY
    };
    // Remove selection element
    if (selection) {
        document.body.removeChild(selection);
        selection = null;
    }
    stopCaptureMode(); // Call stopCaptureMode here
    detect();
}

function capture(video, x, y, w, h) {
    const bBox = video.getBoundingClientRect();
    const scaleX = video.videoWidth / bBox['width'];
    const scaleY = video.videoHeight / bBox['height'];
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, x * scaleX, y * scaleY, w * scaleX, h * scaleY, 0, 0, w, h);
    return canvas;
}

async function manualSearch() {
    const searchText = document.getElementById(this.name).value;
    searchAndModifyDOM(searchText);
}

const detect = async () => {
    const video = document.getElementById('my-video_html5_api');
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);
    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    if (width <= 0 || height <= 0) {
        console.log('Invalid selection area. Please make sure the selection width and height are greater than 0.');
        return;
    }
    const canvas = capture(video, x, y, width, height);
    canvas.toBlob(async (blob) => {
        const worker = await Tesseract.createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        await worker.setParameters({ tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY, tessedit_pageseg_mode: Tesseract.SPARSE_TEXT });
        const output = await worker.recognize(blob);
        searchAndModifyDOM(output.data.text.slice(0, -1));
    });
};

const searchAndModifyDOM = async (queryText) => {
    const searchMode = document.querySelector("input[name='searchmode']:checked").value;
    const userID = "pilot";
    const modal = document.getElementById("myModal");
    const modalHeader = document.getElementById("modal-header");
    const videosTab = document.getElementById("videos");
    const tabs = Array.from(document.getElementsByClassName("tab"));
    const tabContents = Array.from(document.getElementsByClassName("tab-content"));

    modalHeader.replaceChildren();
    videosTab.replaceChildren();

    //type="search" id="site-search" name="q"
    const searchBoxinModal = document.createElement('input');
    searchBoxinModal.setAttribute('type', 'search');
    searchBoxinModal.setAttribute('id', 'searchBoxinModal');
    searchBoxinModal.setAttribute('name', 'searchBoxinModal');
    searchBoxinModal.setAttribute('value', queryText);
    modalHeader.appendChild(searchBoxinModal);

    const searchButtonInModal = document.createElement('button');
    searchButtonInModal.innerHTML = "Search";
    searchButtonInModal.setAttribute('id', 'manualSearchInModal');
    searchButtonInModal.setAttribute('name', 'searchBoxinModal');
    searchButtonInModal.setAttribute('type', 'button');
    searchButtonInModal.onclick = manualSearch;
    modalHeader.appendChild(searchButtonInModal);

    const summaryDiv = document.createElement('div');
    

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove("active"));
            tabContents.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            document
                .getElementById(target)
                .classList
                .add("active");
            tabs.forEach(t => t.style.fontWeight = "normal");
            tab.style.fontWeight = "bold";
        });
    });
    // Clear the modal when the close span is clicked
    span.onclick = function () {
        modal.style.display = "none";
        modalHeader.replaceChildren();
        videosTab.replaceChildren();
    }

    const {ESResult, chatGPTResult} = await getSearchResult(queryText, userID, lo, courseName, searchMode);
    summaryDiv.innerHTML += `
        <h3>${queryText}</h3>
        <p>${chatGPTResult}</p>
    `;
    modalHeader.appendChild(summaryDiv);

    // Display videos in the modal
    const promiseOfESResult = ESResult.map(res => new Promise(async (resolve, reject) => {
        const meta = res._source;
        console.log(meta);
        const [filename, captionFile] = await getVideoPath(meta.video_id)
        resolve([meta, filename, captionFile])
    }));
    await Promise.all(promiseOfESResult).then((resolve) => {
        resolve.forEach(
            res => {
                const [meta, filename, captionFile] = res;
                const startTime = meta.start_time; // in milliseconds
                const endTime = meta.end_time; // in milliseconds
                const duration = endTime - startTime; // duration in milliseconds
                const durationInSeconds = msToTime(duration); // convert to mm:ss
                videosTab.innerHTML += `
                    <div class="video-info" 
                    data-video-src="https://curio.oli.cmu.edu/${filename}#t=${startTime / 1000}"
                    data-caption-file="https://curio.oli.cmu.edu/${captionFile}"
                    data-video-title="${meta.video_title.replaceAll('_', ' ')}"
                    data-course-name="${meta.course_name.replaceAll('_', ' ')}"
                    data-start-time="${startTime}">
                    <div class="video-thumbnail">
                        <video id="video-player" controls style="width: 100%; height: 100%;">
                        <source src="https://curio.oli.cmu.edu/${filename}#t=${startTime / 1000}" type="video/mp4">
                        Your browser does not support the video tag.
                        </video>
                        <span class="video-duration">${durationInSeconds}</span>
                    </div>
                    <div class="video-details">
                        <p><strong>${meta.video_title.replaceAll('_', ' ')
                    }</strong></p>
                        <p>"${meta.text}"</p>
                        <p>${meta.course_name.replaceAll('_', ' ')
                    }</p>
                    </div>
                    </div>
                    <br>`
            }
        )
    });
    modal.style.display = "block";
    // Adding event listener on .video-info div
    const videoInfoDivs = document.querySelectorAll('.video-info');
    videoInfoDivs.forEach(div => {
        div.addEventListener('click', (e) => { // Load video and transcript
            const videoSrc = e
                .currentTarget
                .dataset
                .videoSrc;
            const videoTitle = e
                .currentTarget
                .dataset
                .videoTitle;
            const transcript = e
                .currentTarget
                .dataset
                .captionFile;
            const courseName = e
                .currentTarget
                .dataset
                .courseName;
            const startTime = e
                .currentTarget
                .dataset
                .startTime;
            // Save current modal content before changing it
            const prevModalContent = document.querySelector('.modal-content').innerHTML;
            // Load video and transcript const transcript = loadTranscript(videoId); // TODO: Assuming loadTranscript function
            // exists Update modal content
            const modalContent = `
            <div class="row">
            <button id="back-btn">-></button>
            </div>
            <div class="row">
            <h2>${videoTitle}</h2>
            </div>
            <div class="row">
            <video id="video-player" controls style="width: 100%; height: 100%;">
            <source src="${videoSrc}" type="video/mp4">
            <track kind="captions"
                src="${transcript}"
                srclang="en" label="English" default>
            Your browser does not support the video tag.
            </video>
            </div>
            <div class="row">
            <p><strong>Course: </strong>${courseName}</p>
            </div>
        `;
            document.querySelector('.modal-content').innerHTML = modalContent;
            // Add event listener on back button to revert to previous state
            document.querySelector('#back-btn').addEventListener('click', () => {
                document.querySelector('.modal-content').innerHTML = prevModalContent; // Assuming prevModalContent exists Adding event listener on .video-info div again
                const videoInfoDivs = document.querySelectorAll('.video-info');
                videoInfoDivs.forEach(div => {
                    div.addEventListener('click', (e) => {
                        const videoSrc = e
                            .currentTarget
                            .dataset
                            .videoSrc;
                        const videoId = e
                            .currentTarget
                            .dataset
                            .videoId;
                        const transcript = e
                            .currentTarget
                            .dataset
                            .captionFile;
                        const videoTitle = e
                            .currentTarget
                            .dataset
                            .videoTitle;
                        const courseName = e
                            .currentTarget
                            .dataset
                            .courseName;
                        const startTime = e
                            .currentTarget
                            .dataset
                            .startTime;
                        // Save current modal content before changing it
                        const prevModalContent = document.querySelector('.modal-content').innerHTML;
                        // Update modal content
                        const modalContent = `
                <div class="row">
                    <button id="back-btn">-></button>
                </div>
                <div class="row">
                    <h2>${videoTitle}</h2>
                </div>
                <div class="row">
                <video id="video-player" controls>
                    <source src="${videoSrc}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
                </div>
                <div class="row">
                    <p><strong>Course: </strong>${courseName}</p>
                </div>
                `;
                        document.querySelector('.modal-content').innerHTML = modalContent;
                        // Add event listener on back button to revert to previous state
                        document.querySelector('#back-btn').addEventListener('click', () => {
                            document.querySelector('.modal-content').innerHTML = prevModalContent; // Assuming prevModalContent exists
                        });
                    });
                });
            });
        });
    });
}

// Fetch the first three sentences from Wikipedia
async function fetchSummary(term, context = "") {
    try {
        const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${term}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status
                }`);
        }
        const json = await response.json();
        return json.extract || "Summary not available."; // If extract is empty, return a default message
    } catch (error) {
        console.error('Error:', error);
        return "An error occurred while fetching the summary."; // Return a default message on error
    }
}

function msToTime(duration) {
    var seconds = parseInt((duration / 1000) % 60),
        minutes = parseInt((duration / (1000 * 60)) % 60),
        hours = parseInt((duration / (1000 * 60 * 60)) % 24);
    hours = (hours < 10)
        ? "0" + hours
        : hours;
    minutes = (minutes < 10)
        ? "0" + minutes
        : minutes;
    seconds = (seconds < 10)
        ? "0" + seconds
        : seconds;
    return (hours === "00")
        ? minutes + ":" + seconds
        : hours + ":" + minutes + ":" + seconds;
}

function startCaptureMode() {
    document
        .body
        .classList
        .add('capture-mode');
    video.addEventListener('mousedown', startSelection);
    video.addEventListener('mousemove', updateSelection);
    video.addEventListener('mouseup', stopSelection);
}
function stopCaptureMode() {
    document
        .body
        .classList
        .remove('capture-mode');
    video.removeEventListener('mousedown', startSelection);
    video.removeEventListener('mousemove', updateSelection);
    video.removeEventListener('mouseup', stopSelection);
}

async function getVideoPath(video_id) {
    try {
        const response = await fetch(`https://curio.oli.cmu.edu/videos/${video_id}`, { method: "GET" });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status
                }`);
        }
        const data = await response.json();
        return [data.filename, data.captionFile];
    } catch (error) {
        console.error('Error:', error);
    }
}

captureBtn.addEventListener('click', startCaptureMode);
window.addEventListener('load', () => {
    const searchBox = document.getElementById('manualSearch');
    video = initPlayer(materials[0]);
    searchBox.addEventListener('click', manualSearch);
    searchBox.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            manualSearch();
        }
    });
});