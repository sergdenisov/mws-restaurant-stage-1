import idb from "idb";
import "babel-polyfill";

const images = require.context("../images", false, /\.jpg$/);
const BACKEND_URL = "http://localhost:1337";
const API_KEY = "AIzaSyCRnfUWfANw0glEAZwOq4vauiP5iZLAXa0";

/**
 * Common database helper functions.
 */
export default new class DBHelper {
  /**
   * DBHelper constructor function
   */
  constructor() {
    this.fetchRestaurantsPromise = null;

    if (!("indexedDB" in window)) {
      return;
    }

    this.dbPromise = idb.open("mwsRestaurant", 1, function(upgradeDb) {
      upgradeDb.createObjectStore("restaurants", { keyPath: "id" });
      upgradeDb.createObjectStore("reviews", { keyPath: "id" });
    });

    this.postponedActions = [];
  }

  /**
   * Fetch all restaurants from network.
   * @return {Promise} Promise object represents all restaurants.
   */
  fetchRestaurantsFromNetwork() {
    return fetch(`${BACKEND_URL}/restaurants`)
      .then(response => response.json())
      .then(restaurants => {
        if (this.dbPromise) {
          this.dbPromise.then(db => {
            const store = db
              .transaction("restaurants", "readwrite")
              .objectStore("restaurants");

            for (const restaurant of restaurants) {
              store.put(restaurant);
            }
          });
        }

        return restaurants;
      })
      .catch(error => {
        console.error(error);
      });
  }

  /**
   * Fetch all restaurants from IndexedDB or network.
   * @return {Promise} Promise object represents all restaurants.
   */
  fetchRestaurants() {
    if (this.fetchRestaurantsPromise) {
      return this.fetchRestaurantsPromise;
    }

    if (!this.dbPromise || window.navigator.onLine) {
      this.fetchRestaurantsPromise = this.fetchRestaurantsFromNetwork();
      return this.fetchRestaurantsPromise;
    }

    this.fetchRestaurantsPromise = this.dbPromise
      .then(db =>
        db
          .transaction("restaurants")
          .objectStore("restaurants")
          .getAll()
      )
      .catch(error => {
        console.error(error);
        this.fetchRestaurantsPromise = null;
      });

    return this.fetchRestaurantsPromise;
  }

  /**
   * Fetch a restaurant by its ID.
   * @param {string} id Restaurant ID.
   * @return {Promise} Promise object represents the restaurant.
   */
  fetchRestaurantByIdFromNetwork(id) {
    return fetch(`${BACKEND_URL}/restaurants/${id}`)
      .then(response => response.json())
      .then(restaurant => {
        if (this.dbPromise) {
          this.dbPromise.then(db => {
            db
              .transaction("restaurants", "readwrite")
              .objectStore("restaurants")
              .put(restaurant);
          });
        }

        return restaurant;
      })
      .catch(error => {
        console.error(error);
      });
  }

  /**
   * Fetch a restaurant by its ID from IndexedDB or network.
   * @param {string} id Restaurant ID.
   * @return {Promise} Promise object represents the restaurant.
   */
  fetchRestaurantById(id) {
    if (!this.dbPromise) {
      return this.fetchRestaurantByIdFromNetwork(id);
    }

    return this.dbPromise
      .then(db =>
        db
          .transaction("restaurants")
          .objectStore("restaurants")
          .get(parseInt(id, 10))
      )
      .then(restaurant => {
        if (restaurant) {
          return restaurant;
        }

        return this.fetchRestaurantByIdFromNetwork(id);
      })
      .catch(error => {
        console.error(error);
      });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood.
   * handling.
   * @param {string} cuisine Cuisine type.
   * @param {string} neighborhood Neighborhood name.
   * @return {Promise} Promise object represents filtered restaurants.
   */
  fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood) {
    // Fetch all restaurants
    return this.fetchRestaurants().then(restaurants => {
      let results = restaurants;
      if (cuisine !== "all") {
        // filter by cuisine
        results = results.filter(r => r.cuisine_type === cuisine);
      }
      if (neighborhood !== "all") {
        // filter by neighborhood
        results = results.filter(r => r.neighborhood === neighborhood);
      }

      return results;
    });
  }

  /**
   * Fetch all neighborhoods.
   * @return {Promise} Promise object represents all neighborhoods.
   */
  fetchNeighborhoods() {
    // Fetch all restaurants
    return this.fetchRestaurants().then(restaurants => {
      // Get all neighborhoods from all restaurants
      const neighborhoods = restaurants.map(
        (v, i) => restaurants[i].neighborhood
      );
      // Remove duplicates from neighborhoods
      return neighborhoods.filter((v, i) => neighborhoods.indexOf(v) === i);
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   * @return {Promise} Promise object represents all cuisines.
   */
  fetchCuisines() {
    // Fetch all restaurants
    return this.fetchRestaurants().then(restaurants => {
      // Get all cuisines from all restaurants
      const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
      // Remove duplicates from cuisines
      return cuisines.filter((v, i) => cuisines.indexOf(v) === i);
    });
  }

  /**
   * Fetch restaurant reviews from network.
   * @param {number} id Restaurant id.
   * @return {Promise} Promise object represents restaurant reviews.
   */
  fetchReviewsFromNetwork(id) {
    return fetch(`${BACKEND_URL}/reviews`)
      .then(response => response.json())
      .then(reviews => {
        if (this.dbPromise) {
          this.dbPromise.then(db => {
            const store = db
              .transaction("reviews", "readwrite")
              .objectStore("reviews");

            for (const review of reviews) {
              store.put(review);
            }
          });
        }

        return reviews.filter(review => review.restaurant_id === id);
      })
      .catch(error => {
        console.error(error);
      });
  }

  /**
   * Fetch restaurant reviews from IndexedDB or network.
   * @param {number} id Restaurant id.
   * @return {Promise} Promise object represents restaurant reviews.
   */
  fetchReviews(id) {
    if (!this.dbPromise || window.navigator.onLine) {
      return this.fetchReviewsFromNetwork(id);
    }

    return this.dbPromise
      .then(db =>
        db
          .transaction("reviews")
          .objectStore("reviews")
          .getAll()
      )
      .then(reviews => reviews.filter(review => review.restaurant_id === id))
      .catch(error => {
        console.error(error);
      });
  }

  /**
   * Delete review by id.
   * @param {number} id Review id.
   * @return {Promise} Promise object represents review deleting.
   */
  deleteReview(id) {
    const postponedFetch = {
      url: `${BACKEND_URL}/reviews/${id}`,
      options: { method: "DELETE" }
    };

    if (this.dbPromise) {
      return this.dbPromise.then(db => {
        const tx = db.transaction("reviews", "readwrite");
        tx.objectStore("reviews").delete(id);

        if (window.navigator.onLine) {
          fetch(postponedFetch.url, postponedFetch.options);
        } else {
          this.postponedActions.push(postponedFetch);
        }

        return tx.complete;
      });
    }

    return fetch(postponedFetch.url, postponedFetch.options);
  }

  /**
   * Post review.
   * @param {Object} review Restaurant review.
   * @return {Promise} Promise object represents review posting.
   */
  postReview(review) {
    const postponedFetch = {
      url: `${BACKEND_URL}/reviews`,
      options: { method: "POST", body: JSON.stringify(review) }
    };

    if (this.dbPromise) {
      return this.dbPromise.then(db => {
        const tx = db.transaction("reviews", "readwrite");
        const store = tx.objectStore("reviews");

        store.getAll().then(reviews => {
          review.id = reviews[reviews.length - 1].id + 1;
          store.put(review);

          postponedFetch.options.body = JSON.stringify(review);

          if (window.navigator.onLine) {
            fetch(postponedFetch.url, postponedFetch.options);
          } else {
            this.postponedActions.push(postponedFetch);
          }
        });

        return tx.complete;
      });
    }

    return fetch(postponedFetch.url, postponedFetch.options);
  }

  /**
   * Edit review.
   * @param {Object} review Restaurant review.
   * @return {Promise} Promise object represents review editing.
   */
  editReview(review) {
    const postponedFetch = {
      url: `${BACKEND_URL}/reviews/${review.id}`,
      options: { method: "PUT", body: JSON.stringify(review) }
    };

    if (this.dbPromise) {
      return this.dbPromise.then(db => {
        const tx = db.transaction("reviews", "readwrite");
        tx.objectStore("reviews").put(review);

        if (window.navigator.onLine) {
          fetch(postponedFetch.url, postponedFetch.options);
        } else {
          this.postponedActions.push(postponedFetch);
        }

        return tx.complete;
      });
    }

    return fetch(postponedFetch.url, postponedFetch.options);
  }

  /**
   * Toggle restaurant favorite.
   * @param {number} id Restaurant id.
   * @param {boolean} isFavorite Flag if restaurant is favorite.
   * @return {Promise} Promise object represents toggling of restaurant favorite.
   */
  toggleRestaurantFavorite(id, isFavorite) {
    const postponedFetch = {
      url: `${BACKEND_URL}/restaurants/${id}/?is_favorite=${isFavorite}`,
      options: { method: "PUT" }
    };

    if (this.dbPromise) {
      return this.dbPromise.then(db => {
        const tx = db.transaction("restaurants", "readwrite");
        const store = tx.objectStore("restaurants");

        store.iterateCursor(cursor => {
          if (!cursor) {
            return;
          }

          if (cursor.value.id === id) {
            return cursor.update({ ...cursor.value, is_favorite: isFavorite });
          }

          return cursor.continue();
        });

        if (window.navigator.onLine) {
          fetch(postponedFetch.url, postponedFetch.options);
        } else {
          this.postponedActions.push(postponedFetch);
        }

        return tx.complete;
      });
    }

    return fetch(postponedFetch.url, postponedFetch.options);
  }

  /**
   * Check postponed actions.
   */
  async checkPostponedActions() {
    if (this.postponedActions.length === 0) {
      return;
    }

    while (this.postponedActions.length !== 0) {
      const action = this.postponedActions.shift();
      await fetch(action.url, action.options);
    }
  }

  /**
   * Restaurant page URL.
   * @param {Object} restaurant Restaurant details.
   * @return {string} Restaurant URL.
   */
  urlForRestaurant(restaurant) {
    return `./restaurant.html?id=${restaurant.id}`;
  }

  /**
   * Restaurant image request.
   * @param {Object} restaurant Restaurant details.
   * @return {string} Restaurant image request.
   */
  imageRequestForRestaurant(restaurant) {
    const photograph = restaurant.photograph || "default";

    return images(`./${photograph}.jpg`);
  }

  /**
   * Map marker for a restaurant.
   * @param {Object} restaurant Restaurant details.
   * @param {Object} map Google Maps' instance.
   * @return {Object} Google Maps' Marker instance.
   */
  mapMarkerForRestaurant(restaurant, map) {
    return new window.google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: this.urlForRestaurant(restaurant),
      map: map,
      animation: window.google.maps.Animation.DROP
    });
  }

  /**
   * Lazy load Google Maps
   */
  lazyLoadGoogleMaps() {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&callback=initMap`;
    script.defer = true;
    document.body.append(script);
  }
}();
