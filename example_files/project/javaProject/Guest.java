package application;

/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
import application.User;
import java.io.*;
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.util.logging.Level;
import java.util.logging.Logger;
//import java.logging;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.FileWriter;
import java.io.FileReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 *
 * @author Mazen-pc
 */
public class Guest extends User {

	// private static int guestid;
	private String guestname;
	// private String name;
	private int moviesBooked;
	private int revenue;
	private Role role;

	public Guest(String First_name, String Last_Name, int revenue, int moviesBooked) {
		super(First_name, Last_Name, "Guest");

		this.revenue = revenue;
		this.moviesBooked = moviesBooked;
	}

	public String getGuestname() {
		return guestname;
	}

	public void setGuestname(String guestname) {
		this.guestname = guestname;
	}

	public int getMoviesBooked() {
		return moviesBooked;
	}

	public void setMoviesBooked(int moviesBooked) {
		this.moviesBooked = moviesBooked;
	}

	public int getRevenue() {
		return revenue;
	}

	public void setRevenue(int revenue) {
		this.revenue = revenue;
	}

	public void rating(String rating, String id) {

		try (BufferedWriter br = new BufferedWriter(new FileWriter("E:\\java oop projects\\oop1\\src\\rating.txt")))

		{

			br.write("id:" + id + " " + " rating " + rating);

			br.close();
		} catch (IOException ex) {
			Logger.getLogger(Guest.class.getName()).log(Level.SEVERE, null, ex);
		}

	}

	public void search(int id) {
		try (BufferedReader br = new BufferedReader(
				new FileReader("E:\\java oop projects\\oop1\\src\\main\\java\\Guest.txt"))) {
			String line;
			int count;

			String m = br.readLine();
			int idoffile;
			String[] movies;
			while ((line = br.readLine()) != null) {

				String[] data = line.split("\\s+");
				idoffile = Integer.parseInt(data[0]);
				String history = data[0];
				movies = line.split(" ");

				if (id == idoffile) {

					System.out.println(movies[id]);

				}

			}
		} catch (FileNotFoundException ex) {
			Logger.getLogger(Guest.class.getName()).log(Level.SEVERE, null, ex);
		} catch (IOException ex) {
			Logger.getLogger(Guest.class.getName()).log(Level.SEVERE, null, ex);
		}

	}

	public static void displayUserHistoryt(int id) {
		String inputFileName = "guest.txt"; // File to read from

		try (BufferedReader reader = new BufferedReader(new FileReader(inputFileName))) {
			String line;

			while ((line = reader.readLine()) != null) {
				int idFromFile = Integer.parseInt(line);
				String nameFromFile = reader.readLine();
				int ageFromFile = Integer.parseInt(reader.readLine());
				int historyLength = Integer.parseInt(reader.readLine());

				if (id == idFromFile) {
					System.out.println("Guest ID: " + idFromFile);
					System.out.println("Guest Name: " + nameFromFile);
					System.out.println("Guest Age: " + ageFromFile);
					System.out.println("Guest History:");

					for (int i = 0; i < historyLength; i++) {
						String historyEntry = reader.readLine();
						System.out.println(historyEntry);
					}
					System.out.println(); // Separate different guests' information
					return; // Exit the function after displaying information for the chosen guest
				} else {
					// Skip reading the history for other guests
					for (int i = 0; i < historyLength; i++) {
						reader.readLine();
					}
				}
			}

			System.out.println("Guest with ID " + id + " not found.");
		} catch (IOException | NumberFormatException e) {
			System.out.println("An error occurred while reading the file: " + e.getMessage());
		}
	}
	public String toString() {
		return "id: " + this.get_id() + " First name: " + this.get_FirstName() + " Last Name: "+this.getLast_name() + " Money spent: " + this.revenue + " Movies booked: " + this.moviesBooked;
	}
}
