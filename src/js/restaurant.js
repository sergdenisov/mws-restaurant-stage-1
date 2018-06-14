import DBHelper from "../js/dbhelper";
import "../css/all.css";
import runtime from "serviceworker-webpack-plugin/lib/runtime";

if ("serviceWorker" in navigator) {
  runtime.register();
}

const current = { restaurant: null };

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  fetchRestaurantFromURL().then(restaurant => {
    const map = new window.google.maps.Map(document.querySelector(".js-map"), {
      zoom: 16,
      center: restaurant.latlng,
      scrollwheel: false
    });
    document.querySelector(".js-map-static").style = "display: none";
    fillBreadcrumb(restaurant);
    DBHelper.mapMarkerForRestaurant(restaurant, map);
  });
};

/**
 * Get current restaurant from page URL.
 * @return {Promise} Promise object represents the restaurant.
 */
function fetchRestaurantFromURL() {
  if (current.restaurant) {
    // restaurant already fetched!
    return Promise.resolve(current.restaurant);
  }

  const id = getParameterByName("id");
  if (!id) {
    // no id found in URL
    console.error("No restaurant id in URL");
    return Promise.reject();
  }

  return DBHelper.fetchRestaurantById(id).then(restaurant => {
    fillRestaurantHTML(restaurant);
    current.restaurant = restaurant;
    return restaurant;
  });
}

/**
 * Add restaurant name to the breadcrumb navigation menu.
 * @param {Object} restaurant Restaurant details.
 */
function fillBreadcrumb(restaurant) {
  const breadcrumbs = document.querySelector(".js-breadcrumbs");
  const li = document.createElement("li");

  li.className = "breadcrumbs__item";
  li.innerHTML = restaurant.name;
  breadcrumbs.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 * @param {string} name Parameter name.
 * @param {string} url Url with parameters.
 * @return {string} Parameter value;
 */
function getParameterByName(name, url = window.location.href) {
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`);
  const results = regex.exec(url);

  if (!results) {
    return null;
  }

  if (!results[2]) {
    return "";
  }

  return decodeURIComponent(results[2]);
}

/**
 * Create restaurant HTML and add it to the web page.
 * @param {Object} restaurant Restaurant details.
 */
function fillRestaurantHTML(restaurant) {
  const container = document.querySelector(".js-restaurant");
  const name = container.querySelector(".js-restaurant-name");
  name.innerHTML = restaurant.name;

  const address = container.querySelector(".js-restaurant-address");
  address.innerHTML = restaurant.address;

  const image = container.querySelector(".js-restaurant-image");
  const imageRequest = DBHelper.imageRequestForRestaurant(restaurant);
  image.src = imageRequest.images[imageRequest.images.length - 1].path;
  image.srcset = imageRequest.srcSet;
  image.alt = `Image of the restaurant ${restaurant.name}`;

  const cuisine = container.querySelector(".js-restaurant-cuisine");
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML(restaurant.operating_hours);
  }

  // fill reviews
  fillReviewsHTML(restaurant.reviews);
}

/**
 * Create restaurant operating hours HTML table and add it to the web page.
 * @param {Object} operatingHours Restaurant operating hours.
 */
function fillRestaurantHoursHTML(operatingHours) {
  const hours = document.querySelector(".js-restaurant-hours");

  for (const [operatingDay, operatingHour] of Object.entries(operatingHours)) {
    const row = document.createElement("tr");

    const day = document.createElement("td");
    day.className = "restaurant-hours__cell";
    day.innerHTML = operatingDay;
    row.appendChild(day);

    const time = document.createElement("td");
    time.className = "restaurant-hours__cell";
    time.innerHTML = operatingHour;
    row.appendChild(time);

    hours.appendChild(row);
  }
}

/**
 * Create all reviews HTML and add them to the web page.
 * @param {Object} reviews Restaurant reviews.
 */
function fillReviewsHTML(reviews) {
  const container = document.querySelector(".js-reviews");
  const title = document.createElement("h2");
  title.className = "reviews__title";
  title.innerHTML = "Reviews";
  container.appendChild(title);

  if (!reviews) {
    const noReviews = document.createElement("p");
    noReviews.innerHTML = "No reviews yet!";
    container.appendChild(noReviews);
    return;
  }

  const ul = document.querySelector(".js-reviews-list");
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
}

/**
 * Create review HTML and add it to the web page.
 * @param {Object} review Restaurant review.
 * @return {Object} Restaurant review HTML element.
 */
function createReviewHTML(review) {
  const li = document.createElement("li");
  li.className = "reviews__item";

  const name = document.createElement("h3");
  name.className = "reviews__name";
  name.innerHTML = review.name;
  li.appendChild(name);

  const date = document.createElement("time");
  date.className = "reviews__date";
  date.innerHTML = review.date;
  li.appendChild(date);

  const rating = document.createElement("strong");
  rating.className = "reviews__rating";
  rating.innerHTML = `Rating: ${review.rating}`;
  li.appendChild(rating);

  const comments = document.createElement("p");
  comments.className = "reviews__comments";
  comments.innerHTML = review.comments;
  li.appendChild(comments);

  return li;
}
