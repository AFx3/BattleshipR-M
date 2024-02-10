function updateClock() {
    var now = new Date();
    var hours = now.getHours();
    var minutes = now.getMinutes();
    var seconds = now.getSeconds();

    // add zero in front of numbers < 10
    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    var timeString = hours + ":" + minutes + ":" + seconds;

    // update the clock's time
    document.getElementById("clock").innerHTML = timeString;
}

// update every second
setInterval(updateClock, 1000);

// initial call to display time immediately
updateClock();