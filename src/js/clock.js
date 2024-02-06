function updateClock() {
    var now = new Date();
    var hours = now.getHours();
    var minutes = now.getMinutes();
    var seconds = now.getSeconds();

    // Aggiungi zero iniziale se il numero è inferiore a 10
    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    var timeString = hours + ":" + minutes + ":" + seconds;

    // Aggiorna il contenuto dell'elemento con id "clock"
    document.getElementById("clock").innerHTML = timeString;
}

// Aggiorna l'orologio ogni secondo
setInterval(updateClock, 1000);

// Chiamata iniziale per visualizzare subito l'ora
updateClock();