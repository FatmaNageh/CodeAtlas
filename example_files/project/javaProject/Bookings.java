package application;

import java.time.LocalDate;

//import java.util.Date;

//booking class includes all the necessary details for the movie booking

import java.util.Date;
import application.Shows;
import java.util.HashMap;
import java.util.Map.Entry;

public class Bookings {
	private static int allBookings = 0; // keep track of total num bookings
	private int bookingNum;
	private static HashMap<Integer, Integer> showIDAndNumOfBookings = new HashMap<Integer, Integer>();// SHOW ID & SHOW
																										// COUNTER
	private static HashMap<Integer, Integer> movieIDAndNumOfBookings = new HashMap<Integer, Integer>();// MOVIE ID &
																										// MOVIE COUNTER
	private LocalDate datecreated = LocalDate.now();// unused for now
	// private String bookedShowTitle;
	// private String bookedGuestName;
	// private int seatber;
	// private int hallNumber;
	private Seat seat;
	private Hall hallNum;
	private Movies bookedMovie;
	private Receptionist bookingReceptionist;
	private Guest BookedGuest;
	private Shows bookedShow;
	private int id;

	public Bookings(LocalDate date, Movies movie, Guest guest, Receptionist recep, Seat seat, Hall hallNum,
			Shows bookedShows) {
		allBookings++;
		bookingNum = allBookings;
		this.datecreated = date;
		this.bookedMovie = movie;
		this.BookedGuest = guest;
		this.bookingReceptionist = recep;
		this.seat = seat;
		this.hallNum = hallNum;
		this.bookedShow = bookedShows;
	}

	Bookings() {

	}

//	Bookings(int booking_num, Date date, Movies movie, Guest guest, Receptionist recep, int seatber,
//			int hallNumber) {
//		this.bookingNum = booking_num;
//		this.datecreated = date;
//		this.bookedMovie = movie;
//		this.BookedGuest = guest;
//		this.bookingReceptionist = recep;
//		//this.seatber = seatber;
//		//this.hallNumber = hallNumber;
//	}

//	Bookings(Shows bookedShowTitle, int seatber, int hallNumber, Guest guestName, Movies bookedMovie,
//			Receptionist bookingReceptionist, Guest BookedGuest) {
//
//		allBookings++;
//		bookingNum = allBookings;
//		this.bookedGuestName = guestName.getGuestname();
//		this.bookedShowTitle = bookedShowTitle.getShowTitle();
//		//this.seatber = seatber;
//		//this.hallNumber = hallNumber;
//		this.BookedGuest = BookedGuest;
//		this.bookedMovie = bookedMovie;
//		this.bookingReceptionist = bookingReceptionist;
//	}

//	public Bookings(int bookingNum, String bookedShowTitle, String bookedGuestName, Date date, int seatber,
//			int hallNumber, Movies bookedMovie, Receptionist bookingReceptionist, Guest BookedGuest) {
//		this.bookingNum = bookingNum;
//		this.bookedShowTitle = bookedShowTitle;
//		this.bookedGuestName = bookedGuestName;
//		//this.seatber = seatber;
//		//this.hallNumber = hallNumber;
//		this.bookedMovie = bookedMovie;
//		this.bookingReceptionist = bookingReceptionist;
//		this.BookedGuest = BookedGuest;
//	}

//	Bookings(Shows bookedShowTitle, Guest guestName) {
//
//		
//		bookingNum = allBookings;
//		String name = null;
//		this.bookedGuestName = name;
//		this.bookedShowTitle = bookedShowTitle.getShowTitle();
//		// this.seatber = seatber;
//		// this.hallNumber = hallNumber;
//	}

//	@Override
//	public String toString() {
//
//		return "Booking# " + bookingNum + " Guest: " + bookedGuestName + " Has booked movie: " + bookedShowTitle; // + "
//																													// At
//																													// hall
//																													// "+
//																													// hallNumber+
//																													// "
//																													// Seat:
//																													// "+seatber;
//
//	}

	public int getId() {
		return id;
	}

	public void setId(int id) {
		this.id = id;
	}

	public int getBookingNum() {
		return bookingNum;
	}

	public void setBookingNum(int bookingNum) {
		this.bookingNum = bookingNum;
	}

	public LocalDate getDatecreated() {
		return datecreated;
	}

	public void setDatecreated(LocalDate datecreated) {
		this.datecreated = datecreated;
	}

	public Seat getSeat() {
		return seat;
	}

	public void setSeat(Seat seat) {
		this.seat = seat;
	}

	public Hall getHallNum() {
		return hallNum;
	}

	public void setHallNum(Hall hallNum) {
		this.hallNum = hallNum;
	}

	public Movies getBookedMovie() {
		return bookedMovie;
	}

	public void setBookedMovie(Movies bookedMovie) {
		this.bookedMovie = bookedMovie;
	}

	public Receptionist getBookingReceptionist() {
		return bookingReceptionist;
	}

	public void setBookingReceptionist(Receptionist bookingReceptionist) {
		this.bookingReceptionist = bookingReceptionist;
	}

	public Shows getBookedShow() {
		return bookedShow;
	}

	public void setBookedShow(Shows bookedShow) {
		this.bookedShow = bookedShow;
	}

	public Guest getBookedGuest() {
		return BookedGuest;
	}

	public void setBookedGuest(Guest bookedGuest) {
		BookedGuest = bookedGuest;
	}

	public int getMostBookedMovieID() {
		int mostBookedMovie = 0;
		int mostBookedMovieID = -1;
		for (Entry<Integer, Integer> entry : movieIDAndNumOfBookings.entrySet()) {
			if (entry.getValue() > mostBookedMovie) {
				mostBookedMovie = entry.getValue();
				mostBookedMovieID = entry.getKey();
			}
		}

		return mostBookedMovieID;
	}

	public int getMostBookedShowID() {
		int mostBookedShow = 0;
		int mostBookedShowID = -1;
		for (Entry<Integer, Integer> entry : showIDAndNumOfBookings.entrySet()) {
			if (entry.getValue() > mostBookedShow) {
				mostBookedShow = entry.getValue();
				mostBookedShowID = entry.getKey();
			}
		}

		return mostBookedShowID;
	}

	public void updateNumOfBookingsShow(Integer showID) {// KEY IS SHOW ID AND INCREMMENT IF EXIST
		if (showIDAndNumOfBookings.containsKey(showID)) {

			int currentShowNum = showIDAndNumOfBookings.get(showID);
			int incShowNum = currentShowNum + 1;
			showIDAndNumOfBookings.put(showID, incShowNum);
		}
	}

	public void decrementNumOfBookingsShow(Integer showID) { // if value>0
		if (showIDAndNumOfBookings.containsKey(showID) && showIDAndNumOfBookings.get(showID) > 0) {

			int currentShowNum = showIDAndNumOfBookings.get(showID);
			int incShowNum = currentShowNum - 1;
			showIDAndNumOfBookings.put(showID, incShowNum);
		}
	}

	public int getMostBookedShow() {
		int mostBookedShow = 0;
		for (int i : showIDAndNumOfBookings.values()) {
			if (i > mostBookedShow) {
				mostBookedShow = i;
			}
		}

		return mostBookedShow;
	}

	public static int getMostBookedMovie() {
		int mostBookedMovie = 0;
		for (int i : movieIDAndNumOfBookings.values()) {
			if (i > mostBookedMovie) {
				mostBookedMovie = i;
			}
		}

		return mostBookedMovie;
	}

	public void addShowBookingIDAndCounter(Shows bookedShowTitle) { // ADD A NEW SHOW TO MAP
		if (!showIDAndNumOfBookings.containsKey(bookedShowTitle.getShowID())) { // key unique
			showIDAndNumOfBookings.put(bookedShowTitle.getShowID(), 0);
		}

	}

	public void addMovieBookingIDAndCounter(Movies bookedMovieName) {// ADD A NEW MOVIE TO MAP
		if (!movieIDAndNumOfBookings.containsKey(bookedMovieName.getMovieID())) {
			movieIDAndNumOfBookings.put(bookedMovieName.getMovieID(), 0);
		}
	}

	public void updateNumOfBookingsMovie(Integer movieID, Shows showTitle, Movies movieName) {
		if (movieIDAndNumOfBookings.containsKey(movieID)) {

			int currentMovieNum = movieIDAndNumOfBookings.get(movieID);
			int incMovieNum = currentMovieNum + 1;
			if (showTitle.getShowTitle() == movieName.getMovieName()) {
				movieIDAndNumOfBookings.put(movieID, incMovieNum);
			}
		}
	}

	public void decrementNumOfBookingsMovie(Integer movieID, Shows showTitle, Movies movieName) {
		if (movieIDAndNumOfBookings.containsKey(movieID) && showIDAndNumOfBookings.get(movieID) > 0) {

			int currentMovieNum = movieIDAndNumOfBookings.get(movieID);
			int incMovieNum = currentMovieNum - 1;
			if (showTitle.getShowTitle() == movieName.getMovieName()) {
				movieIDAndNumOfBookings.put(movieID, incMovieNum);
			}
		}
	}

	public void displayBookingsShows() {// display based on IDS
		for (int i : showIDAndNumOfBookings.keySet()) {
			System.out.print(i + "\t");
			System.out.println(showIDAndNumOfBookings.get(i));
		}

	}

	public void displayBookingsMovies() {
		for (int i : movieIDAndNumOfBookings.keySet()) {
			System.out.print(i + "\t");
			System.out.println(movieIDAndNumOfBookings.get(i));
		}
	}

	public String toString() {

		return " Booking# " + bookingNum + "  \n Guest: " + BookedGuest + " \n Has booked movie: " + bookedMovie
				+ "  At hall: " + hallNum + " Seat: " + seat + " \n by receptionist: " + this.bookingReceptionist;

	}

}