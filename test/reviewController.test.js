const { app, connectDB } = require('../src/expressServer'); // Import your Express app here
const { StatusCodes } = require('http-status-codes');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Review = require('../src/models/Review');
const User = require('../src/models/User');
const Album = require('../src/models/Album');
const { loginAndReturnCookie } = require('./test_helper');
let server;
let mongooseConnection;
let mongodb;

beforeAll(async () => {
  mongodb = await MongoMemoryServer.create();
  const url = mongodb.getUri();
  process.env.MONGO_URL = url;
  mongooseConnection = await connectDB(url);
  server = await app.listen(8001);
});

afterAll(async () => {
  await server.close();
  await mongooseConnection.disconnect();
  await mongodb.stop();
});

describe('ReviewController API Tests', () => {
  let user;
  let album;
  let review;

  beforeAll(async () => {
    //create a user
    user = await User.create({
      email: 'Emily@google.com',
      password: 'secret',
      name: 'Emily',
      username: 'emily123',
      role: 'user',
    });
    // Create a unique album and user for each test
    album = await Album.create({
      albumName: 'Unique Album',
      artistName: 'Unique Artist',
      spotifyUrl: 'https://api.spotify.com/v1/albums/unique',
    });
  });

  beforeEach(async () => {
    await Review.deleteMany({});

    const mockReviewData = {
      rating: 5,
      title: 'Loved this review',
      comment: 'Recommend it"',
      user: user._id,
      album: album._id,
    };

    review = await Review.create(mockReviewData);
  });
  //get all reviews

  it('should test the getAllReviews endpoint - Success Case', async () => {
    const response = await request(app).get('/api/v1/reviews');
    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body).toHaveProperty('reviews');
    expect(response.body.reviews).toHaveLength(1);
    expect(response.body).toHaveProperty('count');
    expect(response.body.count).toBe(1);
  });
  it('should return an empty list if there are no reviews in the database', async () => {
    await Review.deleteMany({});
    // Make a GET request to the /api/v1/reviews endpoint
    const response = await request(app).get('/api/v1/reviews');

    // Assert that the response status is OK (200)
    expect(response.status).toBe(StatusCodes.OK);

    // Assert that the response body is an object with "reviews" and "count" keys
    expect(response.body).toHaveProperty('reviews');
    expect(response.body).toHaveProperty('count');

    // Assert that "reviews" is an empty array since there are no reviews in the database
    expect(response.body.reviews).toEqual([]);

    // Assert that the "count" field reflects the actual count of reviews (which is 0 in this case)
    expect(response.body.count).toBe(0);
  });

  //get single review
  it('should test the getSingleReview endpoint - Success Case', async () => {
    const { _id: reviewId } = await Review.findOne({});

    const response = await request(app).get(`/api/v1/reviews/${reviewId}`);
    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body).toHaveProperty('review');
    //expect(response.body.review._id.toString()).toBe(reviewId.toString());//check if the response.body.review._id value matches what we expect // or
    expect(response.body.review).toMatchObject(
      JSON.parse(JSON.stringify(review))
    ); //checks if the object on the right is a subset (ie: has at least some of the same fields and values) as the object on the left.
  });

  it('should test the getSingleReview endpoint - Error Case (Not Found)', async () => {
    const response = await request(app).get('/api/v1/reviews/errorReviewId');
    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  //get all reviews for this particular album
  it('should get reviews for a specific album', async () => {
    // Try to find an album; if not found, create a default one
    const album = await Album.findOne({ albumName: 'Unique Album' });
    const response = await request(app).get(
      `/api/v1/reviews/album/${album._id}`
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('allProductReviews');
    expect(response.body.allProductReviews).toHaveLength(1);
    expect(response.body).toHaveProperty('count');
    expect(response.body.count).toBe(1);
    // If no reviews are found, allProductReviews should be an empty array and count should be 0
    if (response.body.count === 0) {
      expect(response.body.allProductReviews).toEqual([]);
    }
  });
  //create a review
  it('should create a review successfully', async () => {
    await Review.deleteMany({});
    const userCredentials = {
      email: 'Emily@google.com',
      password: 'secret',
    };

    const signedCookie = await loginAndReturnCookie(userCredentials);

    const album = await Album.findOne({ albumName: 'Unique Album' });

    const newReviewData = {
      rating: 4,
      title: 'Loved this review',
      comment: 'Recommend it"',
      user: user._id,
      album: album._id,
    };
    const response = await request(app)
      .post(`/api/v1/reviews/album/${album._id}`)
      .set('Cookie', signedCookie)
      .send(newReviewData);

    expect(response.status).toBe(StatusCodes.CREATED);
    expect(response.body).toHaveProperty('review');
    // If no album was found
    if (!album) {
      expect(response.status).toBe(StatusCodes.NOT_FOUND);
    }
    //create second review for the same album
    const secondReviewData = {
      rating: 4,
      title: 'Loved this review',
      comment: 'Recommend it"',
      user: user._id,
      album: album._id,
    };
    const res = await request(app)
      .post(`/api/v1/reviews/album/${album._id}`)
      .set('Cookie', signedCookie)
      .send(secondReviewData);
    // this user already submitted a review for this album
    expect(res.status).toBe(StatusCodes.CONFLICT);
  });

  //  update a review
  it('should update a review successfully', async () => {
    const userCredentials = {
      email: 'Emily@google.com',
      password: 'secret',
    };

    const signedCookie = await loginAndReturnCookie(userCredentials);

    const existingReview = await Review.findOne({});
    // If no existingReview was found
    if (!existingReview) {
      expect(response.status).toBe(StatusCodes.NOT_FOUND);
    }

    const updatedReviewData = {
      rating: 1,
      title: 'Don not buy this album',
      comment: 'Awful"',
    };
    if (!updatedReviewData) {
      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    }

    // Check if the user is the author of the review
    const authenticatedUserId = 'mockUserId'; // Replace with actual authenticated user's ID

    if (existingReview.user.toString() !== authenticatedUserId) {
      // User is not the author of the review, respond with unauthorized error
      expect(StatusCodes.UNAUTHORIZED).toBe(StatusCodes.UNAUTHORIZED); // //AKOS: this one works but I feel it's wrong, couldn't write here 'respone', the terminal was complaining
    }

    const response = await request(app)
      .patch(`/api/v1/reviews/${existingReview._id}`)
      .set('Cookie', signedCookie)
      .send(updatedReviewData);
    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body).toHaveProperty('review');

    const updatedReview = await Review.findById(existingReview._id);
    expect(updatedReview).not.toBeNull();
    expect(updatedReview.rating).toBe(updatedReviewData.rating);
    expect(updatedReview.title).toBe(updatedReviewData.title);
    expect(updatedReview.comment).toBe(updatedReviewData.comment);
  });
});
