package application;

import java.io.Serializable;
import java.text.SimpleDateFormat;

/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */

import java.util.Date;

@SuppressWarnings("serial")
public class Movies implements Serializable {

	private String movieName;

	//enum movieGenre {
		//action, adventure, comedy, romance, horror, mystery, scifi, fantasy, anime, sports, narrative, documentary
	//};

	//private movieGenre movie_genre;
	private String movieGenre;
	private String movieDirector;
	private Date published_Movie_Date = new Date();
	private SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd");
	private String movieDuration = "";
	private int movieID;
	private long movie_ID;
	private int movieTicketPrice;
	private int movieDurationHours;
	private int movieDurationMin;
	//private String movieID_String = "";
	//private String movieTicketPrice_String = "";
	private static int allMovies = 1;
	
	Movies(long movieID,String movieName, int movieTicketPrice, String movieDirector, String movie_genre, Date published_Movie_Date , int duration_Hours, int duration_Minutes) {

		this.movieName = movieName;
		this.movieDirector = movieDirector;
		this.movieGenre = movie_genre;
		//this.movie_genre = movieGenre.valueOf(movie_genre);
		this.movieTicketPrice = movieTicketPrice;
		//this.movieID_String = String.valueOf(movieID);
		//this.movieTicketPrice_String = String.valueOf(movieTicketPrice);
		this.movie_ID = movieID;
		this.movieID = allMovies;
		allMovies += 1;
        this.published_Movie_Date = published_Movie_Date;
		//movie_Release_Date_String = release_Date_Format.format(movie_Release_Date);

		if (duration_Hours >= 3) {
			movieDuration = "3:";
		} else if (duration_Hours <= 1) {
			movieDuration = "1:";
		} else {
			movieDuration = "2:";
		}
		if (duration_Minutes >= 0 && duration_Minutes <= 9) {
			movieDuration += "0" + duration_Minutes + " hrs";
		} else if (duration_Minutes < 0) {
			movieDuration += "00 hrs";
		} else if (duration_Minutes >= 59) {
			movieDuration += "59 hrs";
		} else {
			movieDuration += duration_Minutes + " hrs";
		}
		
		this.movieDurationHours = duration_Hours;
        this.movieDurationMin = duration_Minutes;
	}

	//public void display() {

		//System.out.println("Movie Name : " + movieName + " , Movie Director : " + movieDirector + " , Release date : "
				//+ movie_Release_Date_String/* +" , Genre : "+movieGenre */ + " , Movie Duration : " + movieDuration);
	//}
	
	public long getMovie_ID() {
		return movie_ID;
	}

	public void setMovieName(String movieName) {
		this.movieName = movieName;
	}

	public String getMovieName() {
		return movieName;
	}

	public void setMovieTicketPrice(int movieTicketPrice) {
		this.movieTicketPrice = movieTicketPrice;
	}

	public int getMovieTicketPrice() {
		return movieTicketPrice;
	}

	//public void setMovieGenre(String movie_genre) {
		//this.movie_genre = movieGenre.valueOf(movie_genre);
	//}

	//public movieGenre getMovieGenre() {
		//return movie_genre;
	//}
	
	public void setMovieGenre(String movieGenre) {
		this.movieGenre = movieGenre;
	}
	
	public String getMovieGenre() {
		return movieGenre;
	}

	public void setMovieDirector(String movieDirector) {
		this.movieDirector = movieDirector;
	}

	public String getMovieDirector() {
		return movieDirector;
	}

	public void setMovieDuration(int duration_Hours, int duration_Minutes) {
		movieDuration = "";
		if (duration_Hours >= 3) {
			movieDuration = "3:";
		} else if (duration_Hours <= 1) {
			movieDuration = "1:";
		} else {
			movieDuration = "2:";
		}
		if (duration_Minutes >= 0 && duration_Minutes <= 9) {
			movieDuration += "0" + duration_Minutes + " hrs";
		} else if (duration_Minutes < 0) {
			movieDuration += "00 hrs";
		} else if (duration_Minutes >= 59) {
			movieDuration += "59 hrs";
		} else {
			movieDuration += duration_Minutes + " hrs";
		}
	}

	public String getMovieDuration() {
		return movieDuration;
	}

	//public void setMovieReleaseDate(int day_of_release, int month_of_release, int year_of_release) {
		//movie_Release_Date_String = "";
		//movie_Release_Date.setDate(day_of_release);
		//movie_Release_Date.setMonth(month_of_release - 1);
		//movie_Release_Date.setYear(year_of_release - 1900);
		//movie_Release_Date_String = release_Date_Format.format(movie_Release_Date);
	//}

	//public String getMovieReleaseDate() {
		//return movie_Release_Date_String;
	//}

	public void setMovieID(int movieID) {
		this.movieID = movieID;
	}

	public int getMovieID() {
		return movieID;
	}

	public String getMovieID_String() {
		return movieID+"";
	}

	public String getMovieTicketPrice_String() {
		return movieTicketPrice+"";
	}
	
	public void setMovieDurationMin(int movieDurationMin) {
		this.movieDurationMin = movieDurationMin;
	}
	
	public int getMovieDurationMin() {
		
		return movieDurationMin;
	}
	
	public void setMovieDurationHours(int movieDurationHours) {
		
	   this.movieDurationHours = movieDurationHours;
	}
	public int getMovieDurationHours() {
		return movieDurationHours;
	}
	
	public String getPublishedMovieDateString() {
		
		return dateFormat.format(published_Movie_Date);
	}
	
	public Date getPublishedMovieDate() {
		return published_Movie_Date;
	}
	
	public void setPublishedMovieDate(Date published_Movie_Date) {
		this.published_Movie_Date = published_Movie_Date;
	}
	
	public javafx.beans.property.LongProperty idProperty(){
		return new javafx.beans.property.SimpleLongProperty(movie_ID);
	}
	
	public javafx.beans.property.StringProperty movieNameProperty(){
		return new javafx.beans.property.SimpleStringProperty(movieName);
	}
	
	public javafx.beans.property.IntegerProperty moviePriceProperty(){
		return new javafx.beans.property.SimpleIntegerProperty(movieTicketPrice);
	}
	
	public javafx.beans.property.StringProperty movieDirectorProperty(){
		return new javafx.beans.property.SimpleStringProperty(movieDirector);
	}
	
	public javafx.beans.property.StringProperty movieGenreProperty(){
		return new javafx.beans.property.SimpleStringProperty(movieGenre);
	}
	
	public javafx.beans.property.StringProperty movieDurationProperty(){
		return new javafx.beans.property.SimpleStringProperty(movieDuration);
	}
	
	javafx.beans.property.ObjectProperty<Date> moviePublishedDateProperty(){
		return new javafx.beans.property.SimpleObjectProperty<>(published_Movie_Date);
	}

}
