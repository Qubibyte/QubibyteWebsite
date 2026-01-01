var resources = [
    {
        "id": 1,
        "caption": "[OLD VERSION] Quantum Circuit Simulator",
        "creator": "Trent Rosenthal",
        "date": "March 31st, 2025",
        "thumbnail": "/images/resource1thumb.png"
    },
    {
        "id": 2,
        "caption": "Quantum Circuit Simulator",
        "creator": "Trent Rosenthal",
        "date": "September 14th, 2025",
        "thumbnail": "/images/resource2thumb.png",
        "url": "/simulator"
    },
    /*{
        "id": 2,
        "caption": "Proton NMR Spectroscopy Simulator",
        "creator": "Trent Rosenthal",
        "date": "May 24th, 2025",
        "thumbnail": "images/resource2thumb.png"
    },*/
];

// Reverse order so latest post appears first
resources.reverse();

let carouselContentResources = document.getElementById('carouselContentResources');

resources.forEach((resource, index) => {
    let activeClass = index === 0 ? "active" : "";

    let item = `
        <div class="carousel-item ${activeClass}" data-id="${resource.id}">
            <img src="${resource.thumbnail}" class="d-block w-100" alt="Resource ${resource.id}" style="border-radius: 1rem; max-height: 400px; object-fit: contain;">
        </div>
    `;
    carouselContentResources.innerHTML += item;
});

function updateResourceDetails(index) {
    let resource = resources[index];
    let link = resource.url ? resource.url : `/resources/${resource.id}`;
    document.getElementById("resourcesCaption").innerHTML = `<a href="${link}">${resource.caption}</a>`;
    document.getElementById("resourcesCreator").innerText = `Creator: ${resource.creator}`;
    document.getElementById("resourcesDate").innerText = `📅 Uploaded: ${resource.date}`;
}

let carouselResources = document.getElementById("resourcesCarousel");
carouselResources.addEventListener("slid.bs.carousel", function (event) {
    updateResourceDetails(event.to);
});

// Initialize with first resource details
updateResourceDetails(0);