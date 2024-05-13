const express = require('express');
const bodyParser = require("body-parser");
const socket = require('socket.io');
const fs = require("fs");

const app = express();

let locations = [];

let stations = [2, 75, 170, 320, 510, 658, 863];

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
let speed = 200;
let interval = 7200/speed;

let currentIndex = 0;
let indexFactor = 1;

function emitNextLocation() {
    console.log(currentIndex);
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

setInterval(() => {
    if (shouldPauseStreaming() && !isPaused) {
        stopStreaming();
        isPaused = true;
        const pauseDuration = 3000;
        console.log("Streaming paused for " + pauseDuration + " milliseconds.");
        setTimeout(() => {
            currentIndex = currentIndex + 1*indexFactor;
            startStreaming(interval);
            isPaused = false;
            console.log("Streaming resumed.");
        }, pauseDuration);
    }
}, 10);

io.on('connection', (socket) => {
    console.log('A client connected');
});