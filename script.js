// --------- GreenSignal Realtime Database SPA JS + EmailJS Integration ---------

// SPA Routing
function showPage(page) {
  document.querySelectorAll('.page').forEach(pg => { pg.style.display = 'none'; });
  document.getElementById(page).style.display = 'block';
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.getAttribute('data-page') === page) btn.classList.add('active');
  });
  window.scrollTo(0,0);

  if (page === "report" && document.getElementById('reportForm')) {
    document.getElementById('reportForm').reset();
    document.getElementById('msg').style.display = 'none';
  }
  if (page === "collect") {
    showReports();
  }
}

// Navigation Handler
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.getAttribute('data-page')));
  });
  showPage('home');
  if (document.getElementById('reportForm')) {
    document.getElementById('reportForm').onsubmit = reportSubmit;
  }
  if (document.getElementById('collectorForm')) {
    document.getElementById('collectorForm').onsubmit = collectorSubmit;
  }
  if (document.getElementById('collectCity')) {
    document.getElementById('collectCity').addEventListener('change', showReports);
  }
});

// Detect Location
function detectLocation() {
  var locinp = document.getElementById('location');
  if (!navigator.geolocation) {
    locinp.value = "Not supported";
    return;
  }
  locinp.value = "Detecting...";
  navigator.geolocation.getCurrentPosition(function (pos) {
    var coords = pos.coords.latitude.toFixed(6) + "," + pos.coords.longitude.toFixed(6);
    locinp.value = coords;
  }, function () {
    locinp.value = "";
    alert("Location could not be detected. Please retry or enter manually.");
  });
}

// Submit Report Form
function reportSubmit(e) {
  e.preventDefault();
  var name = document.getElementById('name').value.trim();
  var city = document.getElementById('city').value;
  var desc = document.getElementById('desc').value.trim();
  var location = document.getElementById('location').value.trim();
  var photoInput = document.getElementById('photo');
  var photoURL = "";

  if (photoInput && photoInput.files && photoInput.files[0]) {
    var reader = new FileReader();
    reader.onload = function(evt) {
      photoURL = evt.target.result;
      saveReportToDatabase({ name, city, desc, location, photo: photoURL });
    };
    reader.readAsDataURL(photoInput.files[0]);
  } else {
    saveReportToDatabase({ name, city, desc, location, photo: "" });
  }
}

// Save Report to Realtime Database & email collectors
function saveReportToDatabase(reportData) {
  db.ref('reports').push(reportData)
    .then(() => {
      sendEmailToCollectors(reportData); // <-- integration
      showPage('reportSuccess');
    })
    .catch((error) => {
      alert("Failed to save report: " + error);
    });
}

// EmailJS logic: send report alert to all collectors in the city
function sendEmailToCollectors(report) {
  db.ref('collectors').orderByChild('city').equalTo(report.city).once('value')
    .then(snapshot => {
      if(!snapshot.exists()) return;
      snapshot.forEach(childSnapshot => {
        const collector = childSnapshot.val();
        const emailParams = {
          collector_name: collector.name,
          city: report.city,
          reporter_name: report.name,
          description: report.desc,
          location: report.location,
          to_email: collector.email
        };
        emailjs.send("service_lbbcmuc", "template_qqd6rtz", emailParams)
          .then(() => console.log("✅ Email sent to: " + collector.email))
          .catch(err => console.error("❌ Email failed:", err));
      });
    });
}

// Reset Report Form
function resetReportForm() {
  document.getElementById('reportForm').reset();
  showPage('report');
}

// Collector Registration Save to Firebase
function collectorSubmit(e) {
  e.preventDefault();
  var name = document.getElementById('cname').value.trim();
  var email = document.getElementById('cemail').value.trim();
  var city = document.getElementById('ccity').value;
  var contact = document.getElementById('ccontact').value.trim();
  if (!name || !email || !city || !contact) {
    alert("Fill all fields!");
    return;
  }
  const collector = { name, email, city, contact };
  db.ref('collectors').push(collector)
    .then(() => {
      document.getElementById('collectorForm').reset();
      showPage('registerSuccess');
    })
    .catch(error => {
      alert("Error saving collector: " + error);
    });
}

// Reset Collector Form
function resetCollectorForm() {
  document.getElementById('collectorForm').reset();
  showPage('register');
}

// Show Reports (fetch from Realtime Database)
function showReports() {
  var container = document.getElementById('reportTable');
  container.innerHTML = '<div class="empty-msg">Loading reports...</div>';
  var city = document.getElementById('collectCity') ? document.getElementById('collectCity').value : "";
  db.ref('reports').once('value')
    .then(snapshot => {
      let reports = [];
      snapshot.forEach(childSnapshot => {
        let report = childSnapshot.val();
        report.id = childSnapshot.key;
        if (!city || report.city === city) {
          reports.push(report);
        }
      });
      renderReportList(reports);
    })
    .catch(() => {
      container.innerHTML = '<div class="empty-msg">Error loading reports from Firebase.</div>';
    });
}

// Render Report Cards with Mark as Collected button
function renderReportList(reports) {
  var container = document.getElementById('reportTable');
  if (!reports || reports.length === 0) {
    container.innerHTML = '<div class="empty-msg">No reports found in this city.</div>';
    return;
  }
  var html = '<div class="collect-cards-wrap">';
  for (var i = 0; i < reports.length; i++) {
    var r = reports[i];
    var isCollected = r.status === 'collected';
    var statusClass = isCollected ? 'collected' : 'notdone';
    var statusText = isCollected ? '✓ Collected' : 'Not Collected';
    html += `
    <div class="collect-card">
      <img class="collect-img" src="${r.photo || 'https://placehold.co/340x120/lightgreen/white?text=No+Image'}" alt="Waste" />
      <div class="collect-details"><b>Reported by:</b> ${r.name || ""}</div>
      <div class="collect-details"><b>Details:</b> ${r.desc || ""}</div>
      <div class="collect-details"><b>City:</b> ${r.city || ""}</div>
      <div class="collect-details"><b>Location:</b> ${
        r.location
          ? `<a href="https://maps.google.com/?q=${encodeURIComponent(r.location)}" target="_blank">View on Google Maps</a>`
          : ""
      }</div>
      <div class="collect-status ${statusClass}">${statusText}</div>
      ${!isCollected ? `<button class="btn-collect" onclick="markAsCollected('${r.id}')">✓ Mark as Collected</button>` : ''}
    </div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

// Mark Report as Collected
function markAsCollected(reportId) {
  if (!reportId) {
    alert("Report ID not found!");
    return;
  }
  if (confirm("Mark this report as collected?")) {
    db.ref('reports/' + reportId).update({ status: 'collected' })
      .then(() => {
        alert("✓ Marked as collected!");
        showReports();
      })
      .catch((error) => {
        alert("Failed to update: " + error);
      });
  }
}
