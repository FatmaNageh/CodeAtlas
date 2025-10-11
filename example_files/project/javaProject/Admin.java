package application;

/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */

import java.io.*;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map.Entry;

import javafx.collections.FXCollections;
import javafx.collections.ObservableList;

public class Admin extends User implements User_managment {
	private static int capacityMovies;
	private static int capacityShows;
	private static ObservableList<Movies> moviesList = FXCollections.observableArrayList();
	private static ObservableList<Shows> showsList = FXCollections.observableArrayList();
	//private static ArrayList<Movies> moviesList = new ArrayList<>(capacityMovies);
	//private static ArrayList<Shows> showsList = new ArrayList<>(capacityShows);
	// private static HashMap<Integer,Movies>moviesList=new HashMap<>();
	// private static Bookings bookingInstance2 = new Bookings();
	private static Bookings bookingInstance;
	static HashMap<Integer, Receptionist> receptionist = new HashMap<Integer, Receptionist>();
	static HashMap<Integer, Guest> guests = new HashMap<Integer, Guest>();
	static HashMap<Integer, Movies> movies = new HashMap<Integer, Movies>();
	static HashMap<Integer,Shows> shows=new HashMap<Integer,Shows>();
	// private String unknown;
	int cMovies = capacityMovies;
	int cShows = capacityShows;

//	Admin(String unknown , int cMovies , int capacityShows){
//		this.capacityMovies = capacityMovies;
//		this.capacityShows = capacityShows;
//	}

	public Admin(String name, String Last_Name) {
		super(name, Last_Name,"Admin");
		

	}

	
	public static void addMovie(Movies movie) {
		moviesList.add(movie);
	}
	
	public static void removeMovie(Movies movie) {
		moviesList.remove(movie);
	}
	
	public static void editMovie(int index,Movies movie) {
		moviesList.set(index, movie);
	}
	
	public static void loadMoviesList(List<Movies> loadedMoviesList) {
		moviesList = FXCollections.observableArrayList(loadedMoviesList);
	}
	
	public static ObservableList<Movies> getMoviesList(){
		return moviesList;
	}
	
	public static ObservableList<Shows> getShowsList(){
		return showsList;
	}
	
	public static void addShow(Shows show) {
		showsList.add(show);
	}
	
	public static void removeShow(Shows show) {
		showsList.remove(show);
	}
	
	public static void editShow(int index , Shows show) {
		showsList.set(index, show);
	}
	
	public static void loadShowsList(List<Shows> loadedShowsList) {
		showsList = FXCollections.observableArrayList(loadedShowsList);
	}
	
	public static void fileSavingMoviesList () {
		
		try (ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream("E:\\MIU University Folder\\2nd Academic Year\\1st Semester\\Object Oriented Programming (OOP)\\OOP Project\\Project Progress\\MovieBookingTicketSystem\\src\\Files\\moviesObservableListDataSaved.bin"))) {
        	List<Movies> serializableMoviesList = new ArrayList<>(Admin.getMoviesList());
        	oos.writeObject(serializableMoviesList);
        	oos.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
	}
	
	public static void fileSavingShowsList() {
		
		try (ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream("E:\\MIU University Folder\\2nd Academic Year\\1st Semester\\Object Oriented Programming (OOP)\\OOP Project\\Project Progress\\MovieBookingTicketSystem\\src\\Files\\showsObservableListDataSaved.bin"))) {
        	List<Shows> serializableShowsList = new ArrayList<>(Admin.getShowsList());
        	oos.writeObject(serializableShowsList);
        	oos.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
		
	}
	
	@SuppressWarnings("unchecked")
	public static void fileLoadingMoviesList() {
		
		 try (ObjectInputStream ois = new ObjectInputStream(new FileInputStream("E:\\MIU University Folder\\2nd Academic Year\\1st Semester\\Object Oriented Programming (OOP)\\OOP Project\\Project Progress\\MovieBookingTicketSystem\\src\\Files\\moviesObservableListDataSaved.bin"))) {
	        	List<Movies> loadedMoviesList = (List<Movies>) ois.readObject();
	        	Admin.loadMoviesList(loadedMoviesList);
	            ois.close();
	        } catch (IOException | ClassNotFoundException e) {
	            e.printStackTrace();
	        }
		
	}
	
	@SuppressWarnings("unchecked")
	public static void fileLoadingShowsList() {
		
		  try (ObjectInputStream ois = new ObjectInputStream(new FileInputStream("E:\\MIU University Folder\\2nd Academic Year\\1st Semester\\Object Oriented Programming (OOP)\\OOP Project\\Project Progress\\MovieBookingTicketSystem\\src\\Files\\showsObservableListDataSaved.bin"))) {
	        	List<Shows> loadedShowsList = (List<Shows>) ois.readObject();
	        	Admin.loadShowsList(loadedShowsList);
	            ois.close();
	        } catch (IOException | ClassNotFoundException e) {
	            e.printStackTrace();
	        }
		
	}


	public static String getMovieNameFromID(int movieID) {
		String movieName = "";
		for (Movies movie : moviesList) {
			if (movie.getMovieID() == movieID) {
				movieName = movie.getMovieName();
				break;
			}
		}
		return movieName;
	}

	public static String getShowTitleFromID(int showID) {
		String showTitle = "";
		for (Shows show : showsList) {
			if (show.getShowID() == showID) {
				showTitle = show.getShowTitle();
				break;
			}
		}
		return showTitle;
	}


	public static int getMostRevenueMovie() {

		int mostBookedMovie = bookingInstance.getMostBookedMovie();
		int mostRevenueMovie = 0;
		int mostRevenueMovieIndex = 0;

		for (int i = 0; i < moviesList.size(); i++) {
			int maxMoviePrice = moviesList.get(i).getMovieTicketPrice();

			if (maxMoviePrice * mostBookedMovie > mostRevenueMovie) {
				mostRevenueMovie = maxMoviePrice * mostBookedMovie;
				mostRevenueMovieIndex = i;
			}
		}
		return mostRevenueMovieIndex;

	}

	public static int getMostRevenueShow() {

		int mostBookedShow = bookingInstance.getMostBookedShow();
		int mostRevenueShow = 0;
		int mostRevenueShowIndex = 0;

		for (int i = 0; i < showsList.size(); i++) {
			int maxShowPrice = showsList.get(i).getShowTicketPrice();

			if (maxShowPrice * mostBookedShow > mostRevenueShow) {
				mostRevenueShow = maxShowPrice * mostBookedShow;
				mostRevenueShowIndex = i;
			}
		}

		return mostRevenueShowIndex;

	}

	public void file_writing_MostBookedAndRevenueShowsAndMovies() {

		try {
			FileWriter writer3 = new FileWriter("Most booked & Most Revenue Shows And Movies File");
			writer3.write("Most booked movie: " + getMovieNameFromID(bookingInstance.getMostBookedMovieID()) + "\n");
			writer3.write("Most revenue movie: " + moviesList.get(getMostRevenueMovie()).getMovieName() + "\n" + "\n");
			writer3.write("Most booked show: " + getShowTitleFromID(bookingInstance.getMostBookedShowID()) + "\n");
			writer3.write("Most revenue show: " + showsList.get(getMostRevenueShow()).getShowTitle());
			writer3.close();
		} catch (IOException e) {
			e.printStackTrace();
		}

	}

	@Override
	public void addUser(User user) {
		adding_user_to_the_file(user);

	}

	
	public static void editUser(User new_user,User old_user) throws FileNotFoundException, IOException {
		System.out.println(" the list before editing ");
		ArrayList<User> users = ReadUsers();
		if (search(old_user.get_FirstName())) {
			users.set(users.indexOf(old_user), new_user);
			adding_user_to_the_file(new_user);
			System.out.println("User edited successfully");
			System.out.println(" the list after editing ");
			// readUsersFromFile();
		} else {
			// If the user is not found
			System.out.println("User not found");
		}

	}

	@Override
	public void removeUser(int pos, User u) throws FileNotFoundException, IOException {
		System.out.println(" the list before removing ");
		ArrayList<User> user = ReadUsers();
		user.remove(pos);
		adding_user_to_the_file(u);
		System.out.println(" the list after removing ");
		// readUsersFromFile();
	}

	
	public static boolean search(String searchTerm) throws FileNotFoundException, IOException {
		ArrayList<User> users = ReadUsers();
		for (User user : users) {
			if (user.get_FirstName().equalsIgnoreCase(searchTerm)) {
				return true;
			}
		}
		return false;
	}

	public static void adding_user_to_the_file(User u) {
		try (FileWriter writer = new FileWriter("E:\\MIU University Folder\\2nd Academic Year\\1st Semester\\Object Oriented Programming (OOP)\\OOP Project\\Project Progress\\MovieBookingTicketSystem\\src\\Files\\Users.txt", true)) {
//			for (int i = 0; i < users.size(); i++) {
//				writer.write("User role is :" + users.get(i).getRole() + "\t" + "User First name : "
//						+ users.get(i).get_FirstName() + "\t" + "User Last Name : " + users.get(i).getLast_name() + "\t"
//						+ "User ID is :" + users.get(i).get_id() + "\t" + "UserName is :" + users.get(i).getUserName()
//						+ "\t" + "Password is :" + users.get(i).getPassword() + "\n"); // "\n"
//			}
			StringBuilder sb = new StringBuilder();
			
			sb.append(u.get_id()).append(" ");
			sb.append(u.getRole()).append(" ");
			sb.append(u.get_FirstName()).append(" ");
			sb.append(u.getLast_name()).append(" ");
			sb.append(u.getUserName()).append(" ");
			sb.append(u.getPassword()).append(" ");
			if (u instanceof Guest) {
				Guest k = (Guest) u;
				sb.append(k.getRevenue()).append(" ");
				sb.append(k.getMoviesBooked()).append(" ");
			}
			if (u instanceof Receptionist) {
				Receptionist r = (Receptionist) u;
				sb.append(r.getRevenueMade()).append(" ");
				sb.append(r.getMoviesBooked()).append(" ");
				sb.append(r.getWindowNum()).append(" ");
			}
			writer.write(sb.toString() + "\n");
			writer.flush();

		} catch (IOException e) {
			e.printStackTrace();
		}
	}

	public static ArrayList<User> ReadUsers() throws FileNotFoundException, IOException {
		ArrayList<User> user = new ArrayList<>();

		try (BufferedReader reader = new BufferedReader(new FileReader("E:\\MIU University Folder\\2nd Academic Year\\1st Semester\\Object Oriented Programming (OOP)\\OOP Project\\Project Progress\\MovieBookingTicketSystem\\src\\Files\\Users.txt"))) {
			String line;
			while ((line = reader.readLine()) != null) {
				String[] fields = line.split("\\s+");
				if (fields.length >= 6) {
					
					int id = Integer.parseInt(fields[0]);
					String role = fields[1];
					String First_name = fields[2];
					String Last_Name = fields[3];
					String userName = fields[4];
					String Password = fields[5];
					User u;
					if (role.equals("Guest")) {
						int revenue = Integer.parseInt(fields[6]);
						int mvBooked = Integer.parseInt(fields[7]);
						u = new Guest(First_name, Last_Name, revenue, mvBooked);
						u.setRole(role);
						u.set_id(id);
						u.setUserName(userName);
						u.setPassword(Password);
						
					} else if (role.equals("Receptionist")) {
						int revenue = Integer.parseInt(fields[6]);
						int mvBooked = Integer.parseInt(fields[7]);
						int windowNum = Integer.parseInt(fields[8]);
						u = new Receptionist(First_name, windowNum, revenue, mvBooked, Last_Name);
						u.setRole(role);
						u.set_id(id);
						u.setUserName(userName);
						u.setPassword(Password);
					} else {
						u = new Admin(First_name, Last_Name);
						u.setPassword(Password);
						u.setRole(role);
						u.set_id(id);
						u.setUserName(userName);
					}
//					User u = new User(First_name, Last_Name, role);
//					u.set_id(id);
//					u.setPassword(Password);
//					u.setUserName(userName);
					user.add(u);
				}
			}
		}
		return user;
	}

	public static boolean checkUnique(String userName) throws FileNotFoundException, IOException {
		ArrayList<User> user = ReadUsers();
		for (User u : user) {
			if (u.getUserName().equals(userName)) {
				return false;
			}
		}
		return true;
	}
//
//	public void readUsersFromFile() {
//		try {
//			BufferedReader reader = new BufferedReader(new FileReader("Users"));
//			String line;
//			while ((line = reader.readLine()) != null) {
//				System.out.println(line);
//			}
//			reader.close();
//		} catch (IOException e) {
//			e.printStackTrace();
//		}
//}
	public static HashMap<Integer,Receptionist> ReadReceptionist() throws FileNotFoundException, IOException {
		HashMap<Integer,Receptionist> recep = new HashMap<>();
		ArrayList<User> user = Admin.ReadUsers();
		
		for (User u: user) {
				if(u instanceof Receptionist) {
					recep.put(u.get_id(), (Receptionist) u);
				}
		}
		return recep;
	}
	public static HashMap<Integer,Guest> readGuest() throws FileNotFoundException, IOException{
		HashMap<Integer,Guest> guest = new HashMap<>();
		ArrayList<User> user =ReadUsers();
		for (User u : user) {
			if (u instanceof Guest) {
				guest.put(u.get_id(), (Guest) u);
			}
		}
		return guest;
	}

	public static ArrayList<Bookings> read_booking() throws IOException {
	    ArrayList<Bookings> bookings = new ArrayList<>();
	    ArrayList<User> users = ReadUsers();
	    HashMap<Integer, Receptionist> receptionists = ReadReceptionist();
	    HashMap<Integer, Guest> guests = readGuest();

	    try (DataInputStream inputStream = new DataInputStream(new FileInputStream("booking.dat"))) {
	        while (true) {
	            try {
	                int bookingNum = inputStream.readInt();
	                String formattedDate = inputStream.readUTF();
	                LocalDate date = LocalDate.parse(formattedDate, DateTimeFormatter.ofPattern("dd/MM/yyyy"));
	                Movies movie = null;
	                int movieID = inputStream.readInt();
	                if (movieID != -1) {
	                    movie = movies.get(movieID);
	                }
	                Guest guest = guests.get(inputStream.readInt());
	                Receptionist receptionist = receptionists.get(inputStream.readInt());
	                int seatNumber = inputStream.readInt();
	                ArrayList<Seat> seats = Hall.halls.get(inputStream.readInt());
	                Seat bookedSeat = null;
	                for (Seat seat : seats) {
	                    if (seatNumber == seat.getSeatNumber()) {
	                        bookedSeat = seat;
	                        break;
	                    }
	                }
	                int hallId = inputStream.readInt();
	                int showID = inputStream.readInt();
	                Shows bookedShow = null;
	                if (showID != -1) {
	                    bookedShow = shows.get(showID);
	                }

	                Bookings booking = new Bookings(date, movie, guest, receptionist, bookedSeat, bookedSeat.getHallnum(), bookedShow);
	                booking.setBookingNum(bookingNum);
	                bookings.add(booking);
	            } catch (EOFException e) {
	                break; 
	            }
	        }
	    }

	    return bookings;
	}
	public void receptionist_booking(ArrayList<Bookings> bookings, int recptionist_id) {

		for (Bookings x : bookings) {
			if (x.getBookingReceptionist().get_id() == recptionist_id) {
				System.out.println(x.toString());
				System.out.println("===========================================================");
			}
		}
	}

	public void allReceptionist_reports(HashMap<Integer, Receptionist> all_receptionist) {
		try {
			ArrayList<Bookings> all_Bookings = read_booking();
			for (Entry<Integer, Receptionist> x : all_receptionist.entrySet()) {
				System.out.println(" number of receptionist booking " + x.getValue().getMoviesBooked());
				receptionist_booking(all_Bookings, x.getKey());
			}
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	public Receptionist max_ReceptionistBookings(HashMap<Integer, Receptionist> max) {
		int max_bookings = 0;
		Receptionist maxBookinReceptionist = null;
		for (Entry<Integer, Receptionist> recp : max.entrySet()) {
			if (recp.getValue().getMoviesBooked() >= max_bookings) {
				max_bookings = recp.getValue().getMoviesBooked();
				maxBookinReceptionist = recp.getValue();
			}
		}
		return maxBookinReceptionist;
	}

	public Receptionist max_ReceptionistRevenue(HashMap<Integer, Receptionist> max) {
		int max_revenue = 0;
		Receptionist maxRevenueReceptionist = null;
		for (Entry<Integer, Receptionist> recp : max.entrySet()) {
			if (recp.getValue().getRevenueMade() >= max_revenue) {
				max_revenue = recp.getValue().getRevenueMade();
				maxRevenueReceptionist = recp.getValue();
			}
		}
		return maxRevenueReceptionist;
	}

	public void guest_booking(ArrayList<Bookings> bookings, int guest_id) {

		for (Bookings k : bookings) {
			if (k.getBookedGuest().get_id() == guest_id) {
				System.out.println(k.toString());
				System.out.println("==========================================================");

			}
		}
	}

	public void allGuest_reports(HashMap<Integer, Guest> all_guest) {
		try {
			ArrayList<Bookings> all_Bookings = read_booking();
			for (Entry<Integer, Guest> x : all_guest.entrySet()) {
				System.out.println(" number of guest booking " + x.getValue().getMoviesBooked());
				guest_booking(all_Bookings, x.getKey());
			}
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	public Guest max_GuestBooking(HashMap<Integer, Guest> max) {
		int max_bookings = 0;
		Guest maxBookinGuest = null;
		for (Entry<Integer, Guest> guest : max.entrySet()) {
			if (guest.getValue().getMoviesBooked() >= max_bookings) {
				max_bookings = guest.getValue().getMoviesBooked();
				maxBookinGuest = guest.getValue();
			}
		}
		return maxBookinGuest;
	}

	public Guest max_GuestRevenues(HashMap<Integer, Guest> max) {
		int max_revenue = 0;
		Guest maxRevenueGuest = null;
		for (Entry<Integer, Guest> guest : max.entrySet()) {
			if (guest.getValue().getRevenue() >= max_revenue) {
				max_revenue = guest.getValue().getRevenue();
				maxRevenueGuest = guest.getValue();
			}
		}
		return maxRevenueGuest;
	}
	
	public static boolean searchUserInFile(String username) {
	    try (FileReader reader = new FileReader("E:\\MIU University Folder\\2nd Academic Year\\1st Semester\\Object Oriented Programming (OOP)\\OOP Project\\Project Progress\\MovieBookingTicketSystem\\src\\Files\\Users.txt");
	         BufferedReader bufferedReader = new BufferedReader(reader)) {

	        String line;
	        while ((line = bufferedReader.readLine()) != null) {
	            String[] userAttributes = line.split(" ");

	            // Check if the username matches
	            if (userAttributes.length >= 5 && userAttributes[4].equals(username)) {
	            	int id = Integer.parseInt(userAttributes[0]); 
	            	Role role = Role.valueOf(userAttributes[1]);
	                String firstName = userAttributes[2];
	                String lastName = userAttributes[3];
	                String password = userAttributes[5];

	                return true;
	            }
	        }

	    } catch (IOException e) {
	        e.printStackTrace();
	    }
	    return false;
	}
	
	public static void remove_user_from_file(String username) {
		try {
		    File inputFile = new File("E:\\MIU University Folder\\2nd Academic Year\\1st Semester\\Object Oriented Programming (OOP)\\OOP Project\\Project Progress\\MovieBookingTicketSystem\\src\\Files\\Users.txt");
		    File tempFile = new File("E:\\MIU University Folder\\2nd Academic Year\\1st Semester\\Object Oriented Programming (OOP)\\OOP Project\\Project Progress\\MovieBookingTicketSystem\\src\\Files\\TempUsers.txt");

		    BufferedReader reader = new BufferedReader(new FileReader(inputFile));
		    BufferedWriter writer = new BufferedWriter(new FileWriter(tempFile));

		    String lineToRemove = username;
		    String currentLine;

		    while ((currentLine = reader.readLine()) != null) {
		        String[] userInfo = currentLine.split(" ");

		        if (userInfo.length >= 5) { // Ensure userInfo array has at least 5 elements
		            String currentUsername = userInfo[4]; // Assuming the username is at index 4 in the line

		            if (currentUsername.equals(lineToRemove)) {
		                continue;
		            }
		        }

		        writer.write(currentLine + System.getProperty("line.separator"));
		    }

		    writer.close();
		    reader.close();

		    inputFile.delete();
		    tempFile.renameTo(inputFile);

		  //  System.out.println("User removed successfully.");
		} catch (IOException e) {
		    e.printStackTrace();
		}
	}

}
