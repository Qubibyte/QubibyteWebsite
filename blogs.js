    var blogs = [
        {
            "id": 1,
            "caption": "The Declaration of Qubibyte & Announcement of Qubibyte Quadra",
            "author": "Trent Rosenthal",
            "date": "March 7th, 2025",
            "thumbnail": "/images/blog1thumb.png"
        },
        {
            "id": 2,
            "caption": "Qubibyte Quadra Design Choices",
            "author": "Trent Rosenthal",
            "date": "July 20th, 2025",
            "thumbnail": "/images/blog2thumb.png"
        },
    ];

    // Reverse order so latest post appears first
    blogs.reverse();

    let carouselContentBlogs = document.getElementById('carouselContentBlogs');

    blogs.forEach((blog, index) => {
        let activeClass = index === 0 ? "active" : "";

        let item = `
            <div class="carousel-item ${activeClass}" data-id="${blog.id}">
                <a href="/blog/${blog.id}" style="display: block; cursor: pointer;">
                    <img src="${blog.thumbnail}" class="d-block w-100" alt="Blog ${blog.id}" style="border-radius: 1rem; max-height: 400px; object-fit: contain;">
                </a>
            </div>
        `;
        carouselContentBlogs.innerHTML += item;
    });

    function updateBlogDetails(index) {
        let blog = blogs[index];
        document.getElementById("blogCaption").innerHTML = `<a href="/blog/${blog.id}" class="blog-caption-link">${blog.caption}</a>`;
        document.getElementById("blogAuthor").innerText = `Author: ${blog.author}`;
        document.getElementById("blogDate").innerText = `📅 Uploaded: ${blog.date}`;
    }

    let carouselBlogs = document.getElementById("blogsCarousel");
    carouselBlogs.addEventListener("slid.bs.carousel", function (event) {
        updateBlogDetails(event.to);
    });

    // Initialize with first blog details
    updateBlogDetails(0);