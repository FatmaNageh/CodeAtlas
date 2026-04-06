package application;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.PrintWriter;
import java.io.RandomAccessFile;
import java.io.Serializable;
import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Date;
import java.util.Scanner;
import application.User;

/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */

/**
 *
 * @author Mazen-pc
 */
public class Receptionist extends User implements Serializable {

	private static int countAll;

	// private static int receptionistlDcount ;
	private String ReceptionistName;
	private int windowNum;
	private int revenueMade;
	private int moviesBooked;
	private int bookingsPerR;
	private Role role;
	// private static ArrayList<Bookings> bookingsPerR = new ArrayList<Bookings>();
//  private static int receptionistlDcount;

	public Receptionist(String ReceptionistName, int windowNum, int revenueMade, int moviesBooked,
			String Last_Name) {

		super(ReceptionistName, Last_Name, "Receptionist");
		this.ReceptionistName = ReceptionistName;
		this.windowNum = windowNum;
		this.revenueMade = revenueMade;
		this.moviesBooked = moviesBooked;
	}

	public Receptionist(String ReceptionistName, String Last_Name) {
		super(ReceptionistName, Last_Name, "Receptionist");
		this.ReceptionistName = ReceptionistName;

	}

	public String getReceptionistName() {
		return ReceptionistName;
	}

	public void setReceptionistName(String ReceptionistName) {
		this.ReceptionistName = ReceptionistName;
	}

	public int getWindowNum() {
		return windowNum;
	}

	public void setWindowNum(int windowNum) {
		this.windowNum = windowNum;
	}

	public int getRevenueMade() {
		return revenueMade;
	}

	public void setRevenueMade(int revenueMade) {
		this.revenueMade = revenueMade;
	}

	public int getMoviesBooked() {
		return moviesBooked;
	}

	public void setMoviesBooked(int moviesBooked) {
		this.moviesBooked = moviesBooked;
	}

	public int showpayment(int movieprice, int num) {

		int sum = 0;
		sum = movieprice * num;
		return sum;
	}

	public String toString() {
		return "id: " + this.get_id() + " First name: "  + this.ReceptionistName +" Last name: "+this.getLast_name()+ " window number: " + this.windowNum
				+ " revenue made: " + this.revenueMade + " movies booked: " + this.moviesBooked;
	}

	public static void saveBookingsToFile(String filePath, Bookings book) {
	    try (DataOutputStream outputStream = new DataOutputStream(new FileOutputStream(filePath, true))) {
	        LocalDate currentDate = LocalDate.now();
	        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy");
	        String formattedDate = currentDate.format(formatter);

	        // Write the booking data in the same format as your original method
	        outputStream.writeInt(book.getBookingNum());
	        outputStream.writeUTF(formattedDate.formatted(book.getDatecreated()));
	        if (book.getBookedMovie() != null) {
	            outputStream.writeInt(book.getBookedMovie().getMovieID());
	        } else {
	            outputStream.writeInt(0);
	        }
	        outputStream.writeInt(book.getBookedGuest().get_id());
	        outputStream.writeInt(book.getBookingReceptionist().get_id());
	        outputStream.writeInt(book.getSeat().getSeatNumber());
	        outputStream.writeInt(book.getHallNum().getHallId());
	        if (book.getBookedShow() != null) {
	            outputStream.writeInt(book.getBookedShow().getShowID());
	        } else {
	            outputStream.writeInt(0);
	        }

	        outputStream.writeUTF("\n"); // Add a newline character to separate each line

	        outputStream.flush();
	    } catch (IOException e) {
	        e.printStackTrace();
	    }
	}
//	public static <T extends Serializable> Receptionist deepCopy(Receptionist k) {
//		Receptionist clonnedObject = null;
//		try {
//			ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
//			ObjectOutputStream ojos = new ObjectOutputStream(outputStream);
//			
//			ojos.writeObject(k);
//			ojos.close();
//			
//			ByteArrayInputStream ins = new ByteArrayInputStream(outputStream.toByteArray());
//			ObjectInputStream ois = new ObjectInputStream(ins);
//			clonnedObject = (Receptionist) ois.readObject();
//			ois.close();
//		} catch (IOException e) {
//			e.printStackTrace();
//		} catch (ClassNotFoundException e) {
//			// TODO Auto-generated catch block
//			e.printStackTrace();
//		}
//		return clonnedObject;
//	}
//	public static <T extends Serializable> Guest deepCopy(Guest k) {
//		Guest clonnedObject = null;
//		try {
//			ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
//			ObjectOutputStream ojos = new ObjectOutputStream(outputStream);
//			
//			ojos.writeObject(k);
//			ojos.close();
//			
//			ByteArrayInputStream ins = new ByteArrayInputStream(outputStream.toByteArray());
//			ObjectInputStream ois = new ObjectInputStream(ins);
//			clonnedObject = (Guest) ois.readObject();
//			ois.close();
//		} catch (IOException e) {
//			e.printStackTrace();
//		} catch (ClassNotFoundException e) {
//			// TODO Auto-generated catch block
//			e.printStackTrace();
//		}
//		return clonnedObject;
//	}


	public Bookings CreateBooking(Shows bookingShow, Movies bookingMovie, Guest guest,
			Hall hall, Seat seat) throws FileNotFoundException, IOException {// creates
		// a
		// booking
		// a
		LocalDate date = LocalDate.now(); // ticket
		ArrayList<User> user = Admin.ReadUsers();						// on
		Bookings bookingCreation ; // guest
		// and
		// movie
		for (User u : user) {
			if(u instanceof Receptionist) {
			Receptionist k = (Receptionist) u;
			Receptionist f = k;
			//editUser(k,f.setMoviesBooked(k.getMoviesBooked())++);	
			}
			else if (u instanceof Guest) {
				Guest g = (Guest) u;
				Guest l = g;
			l.setMoviesBooked(g.getMoviesBooked()+1);
			User_managment.editUser(g,l);	

			}
		}
		//if (showID == bookingShow.getShowID() && movieID == bookingMovie.getMovieID()) {
		
		
			bookingCreation = new Bookings(date, bookingMovie, guest, this, seat, hall, bookingShow);
			seat.reserved = true;
			bookingCreation.addShowBookingIDAndCounter(bookingShow);

			bookingCreation.updateNumOfBookingsShow(bookingShow.getShowID());

			bookingCreation.addMovieBookingIDAndCounter(bookingMovie);

			bookingCreation.updateNumOfBookingsMovie(bookingMovie.getMovieID(), bookingShow, bookingMovie);

			this.moviesBooked++;
			this.revenueMade += bookingShow.getShowTicketPrice();
			saveBookingsToFile("booking.dat", bookingCreation);
		//}
		return bookingCreation;
	}

	public void removeBookingFromFile(String FilePath, Bookings book) throws IOException {
		ArrayList<Bookings> booking = Admin.read_booking();

		try (RandomAccessFile raf = new RandomAccessFile(FilePath, "rw")) {
			raf.setLength(0); // Set the file length to 0 to clear its content
			for (Bookings booke : booking) {
				if (booke.getBookingNum() != book.getBookingNum()) {
					saveBookingsToFile("booking.txt", booke);
				}
			}
			ArrayList<Seat> se = Hall.halls.get(book.getHallNum().getHallId());
			for (Seat s : se) {
				if (book.getSeat().getSeatNumber() == s.getSeatNumber()) {
					s.reserved = false;
				}
			}
		} catch (IOException e) {
			e.printStackTrace();
		}

	}

	public void CancelBooking(Shows bookingShow, Movies bookingMovie, Guest guestName, int showID, int movieID,
			Bookings removeBooking) {

//booking files include guest name
//so remove show from booking file based on guest name

		if (showID == bookingShow.getShowID() && movieID == bookingMovie.getMovieID()) {

			removeBooking.decrementNumOfBookingsMovie(movieID, bookingShow, bookingMovie);
			removeBooking.decrementNumOfBookingsShow(showID);

		}

	}// WIP delete booking from booking list in this receptionist

	public void calculatePayment(int moviePrice, int num) {
		int payment = (moviePrice * num); // Calculate the payment

		String fileName = "payment_history.bin"; // File to write payment history

		try (DataOutputStream outputStream = new DataOutputStream(new FileOutputStream(fileName, true))) {
			outputStream.writeInt(super.get_id());
			outputStream.writeUTF(super.get_FirstName());
			outputStream.writeInt(payment);
			outputStream.writeInt(num);
			outputStream.writeInt(moviePrice);

			System.out.println("Payment information written to the file.");
		} catch (IOException e) {
			System.out.println("An error occurred while writing to the file: " + e.getMessage());
		}
	}// WIP calculate total payment based on moviePrice

//lots of getters and setters
	public static int getCountAll() {
		return countAll;
	}

	public static void setCountAll(int countAll) {
		Receptionist.countAll = countAll;
	}

	public static void receptionistToFile() {

		try {
			Scanner originalFile = new Scanner(new File("Users.txt"));

			PrintWriter writer = new PrintWriter("Receptionists.txt");

			String id, name, fullLine;

			while (originalFile.hasNext()) {

				fullLine = originalFile.nextLine();
				if (fullLine.contains("receptionist")) {

					name = fullLine.substring(fullLine.indexOf("name :") + 6, fullLine.lastIndexOf("User ID"));
					id = fullLine.substring(fullLine.indexOf("ID is :") + 7);

					System.out.println(id);
					System.out.println(name);

					writer.write(id + "\n" + name + "\n\n");

				}

			}

			writer.close();
			originalFile.close();

		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}

	}

}
