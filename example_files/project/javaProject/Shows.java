package application;

import java.io.Serializable;

/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */

import java.text.SimpleDateFormat;
import java.util.Date;

@SuppressWarnings("serial")
public class Shows implements Serializable {

	private String showTitle;
	private int showTicketPrice;
	private String showGenre;
	private int showTimeHour;
	private int showTimeMin;
	private int showDateDay;
	private int showDateMonth;
	// private Movies.movieGenre showGenre;
	private Date show_DateAndTime = new Date();
	private SimpleDateFormat show_DateAndTime_Format = new SimpleDateFormat("M/dd h:mm a");
	private String show_DateAndTimeString;
	// private int numOfShowBookings = 0;
	private int showID;
	private long show_ID;
	private static int allShows = 1;
	// private char room;
	// private final int seatNumber = 60;

	// int numberOfBookingsShow; // it should be actually included in the booking
	// class

	Shows(long show_ID, String showTitle, int showTicketPrice, String showGenre,/* char room , */ int show_Time_Hour, int show_Time_Minutes,int show_Date, int show_Month) {

		this.showTitle = showTitle;
		this.showTicketPrice = showTicketPrice;
		this.showGenre = showGenre;
		this.showID = allShows;
		this.show_ID = show_ID;
		this.showTimeHour = show_Time_Hour;
		this.showTimeMin = show_Time_Minutes;
		this.showDateDay = show_Date;
		this.showDateMonth = show_Month;
		// this.room = room;

		// showGenre = movie.getMovieGenre();

		show_DateAndTime.setHours(showTimeHour);
		show_DateAndTime.setMinutes(showTimeMin);
		show_DateAndTime.setDate(showDateDay);
		show_DateAndTime.setMonth(showDateMonth - 1);

		show_DateAndTimeString = show_DateAndTime_Format.format(show_DateAndTime);

		// this.numberOfBookingsShow = 0; // it should be actually included in the
		// booking class
		allShows+=1;

	}

	//public void display() {

		//System.out.println("Show Name : " + showTitle + " , Show Price : " + showTicketPrice + " , Show Theatre Name : "
				//+ theatreName + " , Show Date & Time : " + show_DateAndTimeString + " , Show Duration : "
				//+ showDuration);// +" , Number Of Bookings : "+ numberOfBookingsShow);
	//}
	
	public long getShow_ID() {
		return show_ID;
	}

	public void setShowTitle(String showTitle) {
		
		this.showTitle = showTitle;
		
	}
	
	public String getShowTitle() {
		return showTitle;
	}

	public void setShowTicketPrice(int showTicketPrice) {
		this.showTicketPrice = showTicketPrice;
	}

	public int getShowTicketPrice() {
		return showTicketPrice;
	}
	
    public void setShowGenre(String showGenre) {
    	this.showGenre = showGenre;
	}
    
    public String getShowGenre() {
    	return showGenre;
    }
    
    public int getShowTimeHour() { //getShowTimeHour() ,getShowTimeMinutes(),getShowDateDay(),getShowDateMonth()
    	return showTimeHour;
    }
    
    public int getShowTimeMinutes() {
    	return showTimeMin;
    }

    public int getShowDateDay() {
    	return showDateDay;
    }
    
    public int getShowDateMonth() {
    	return showDateMonth;
    }
    
	public void setShowDateAndTime(int show_Time_Hour, int show_Time_Minutes, int show_Date, int show_Month) {
		show_DateAndTimeString = "";
		show_DateAndTime.setHours(show_Time_Hour);
		show_DateAndTime.setMinutes(show_Time_Minutes);
		show_DateAndTime.setDate(show_Date);
		show_DateAndTime.setMonth(show_Month - 1);
		show_DateAndTimeString = show_DateAndTime_Format.format(show_DateAndTime);
	}

	public String getShowDateAndTime() {
		return show_DateAndTimeString;
	}

	public int getShowID() {
		return showID;
	}
	
	public javafx.beans.property.LongProperty idProperty(){
		return new javafx.beans.property.SimpleLongProperty(show_ID);
	}
	
	public javafx.beans.property.StringProperty showTitleProperty(){
		return new javafx.beans.property.SimpleStringProperty(showTitle);
	}
	
	public javafx.beans.property.IntegerProperty showTicketPriceProperty(){
		return new javafx.beans.property.SimpleIntegerProperty(showTicketPrice);
	}
	
	public javafx.beans.property.StringProperty showGenreProperty(){
		return new javafx.beans.property.SimpleStringProperty(showGenre);
	}
	
	public javafx.beans.property.StringProperty show_DateAndTimeProperty(){
		return new javafx.beans.property.SimpleStringProperty(show_DateAndTimeString);
	}
//public void setRoom(char room) {this.room = room;}
//public char getRoom() {return room;}
//public Movies.movieGenre getShowGenre() {return showGenre;}
//public void updateNumOfShows() {numOfShowBookings++;}
//public int getNumOfShows() {return numOfShowBookings;}

}
