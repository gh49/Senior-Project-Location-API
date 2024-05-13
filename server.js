const express = require('express');
const bodyParser = require("body-parser");
const socket = require('socket.io');
const fs = require("fs");

const app = express();

let locations = [];

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
    res.sendFile('D:/KFUPM/Senior Project Files/Nodejs API/index.html');
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

const io = socket(server)
const speed = 200;
const interval = 7200/speed;

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

setInterval(emitNextLocation, interval);

io.on('connection', (socket) => {
    console.log('A client connected');
});