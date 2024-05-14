const express = require('express');
const bodyParser = require("body-parser");
const socket = require('socket.io');
const fs = require("fs");

const app = express();

let locations = [];

let stations = [0, 75, 170, 320, 510, 658, 865];

fs.readFile("tram_path.json", "utf8", (err, data) => {
    if (err) {
        console.error("Error reading file:", err);
        return;
    }

    try {
        const pathData = JSON.parse(data);
        locations = pathData.points;
    } catch (parseError) {
        console.error("Error parsing JSON:", parseError);
    }
});

app.get('/', (req, res) => {
    res.send('this is the root');
});

app.post("/tram/path", bodyParser.json(), (req, res) => {
    fs.writeFile("tram_path.json", JSON.stringify(req.body), (err) => {
        if (err) {
            console.error("Error writing file:", err);
            res.status(500).send("Error saving request data.");
            return;
        }
        console.log("Request body saved to request.json");
        res.status(200).send("Request body saved successfully.");
    });
});

app.get("/tram/path/:index", (req, res) => {
    const index = req.params.index;
    res.status(200).send(locations[index]);
})

const port = 3000;
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

function areEqualDouble(num1, num2, epsilon = Number.EPSILON) {
    return Math.abs(num1 - num2) < epsilon;
}

const io = socket(server)
let speed = 100;
let interval = 7200/speed;

let currentIndex = 0;
let indexFactor = 1;

function emitNextLocation() {
    //console.log(currentIndex);
    const location = locations[currentIndex];
    io.emit('location', location);

    if(currentIndex == 0) {
        indexFactor = 1;
    }
    else if(currentIndex == locations.length - 1) {
        indexFactor = -1;
    }
    currentIndex = currentIndex + 1*indexFactor;
}

let intervalId;
let isPaused = false;

function startStreaming(interval) {
    intervalId = setInterval(emitNextLocation, interval);
}

function stopStreaming() {
    clearInterval(intervalId);
}

function shouldPauseStreaming() {
    return stations.includes(currentIndex);
}

startStreaming(interval);

const pauseDuration = 3;

setInterval(() => {
    if (shouldPauseStreaming() && !isPaused) {
        stopStreaming();
        isPaused = true;
        console.log("Streaming paused for " + pauseDuration + " seconds.");
        setTimeout(() => {
            if(currentIndex == 0) {
                indexFactor = 1;
            }
            else if(currentIndex == locations.length - 1) {
                indexFactor = -1;
            }
            currentIndex = currentIndex + 1*indexFactor;
            startStreaming(interval);
            isPaused = false;
            console.log("Streaming resumed.");
        }, pauseDuration*1000);
    }
}, 10);

const srcStation = stations[2];
const dstStation = stations[6];

function tramDirectlyToStation() {
    if(currentIndex == srcStation) {
        return true;
    }
    if(currentIndex > srcStation && indexFactor == -1) {
        return true;
    }
    if(currentIndex < srcStation && indexFactor == 1) {
        return true;
    }
    return false;
}

setInterval(emitEstimation, 3000);

function emitEstimation() {
    if(isPaused) {
        return;
    }
    let time;
    if(currentIndex == srcStation) {
        time = 0;
    }
    else if(tramDirectlyToStation()) {
        time = simpleEstimator(currentIndex, srcStation, 1);
    }
    else {
        time = complexEstimator();
    }

    console.log(`time left: ${time}`);
    io.emit('time', time);
}

function simpleEstimator(currentIndex, srcStation, minusFactor) {
    const distanceToSrc = Math.abs((currentIndex - srcStation) * 2);
    let stationsNum = Math.abs(stationsBetween(currentIndex, srcStation) - minusFactor);
    const totalTime = 3.6 * (distanceToSrc / speed) + stationsNum * pauseDuration;
    return totalTime;
}

function complexEstimator() {
    let end;
    if(currentIndex > srcStation) {
        end = locations.length - 1;
    }
    else {
        end = 0;
    }
    const totalTime = simpleEstimator(currentIndex, end, 0) + simpleEstimator(end, srcStation, 0) - pauseDuration;
    return totalTime;
}

function stationsBetween(p1, p2) {
    let count = 0;
    let big, small;
    if(p1 > p2) {
        big = p1;
        small = p2;
    }
    else {
        big = p2;
        small = p1;
    }
    for(let i = 0; i < stations.length; i++) {
        if(inRange(stations[i], small, big)) {
            count++;
        }
    }
    return count;
}

function inRange(point, min, max) {
    if(point >= min && point <= max) {
        return true;
    }
    return false;
}

io.on('connection', (socket) => {
    console.log('A client connected');
});