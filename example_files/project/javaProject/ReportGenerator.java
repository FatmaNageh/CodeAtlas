package application;

import java.util.List;
import java.util.ArrayList;

public class ReportGenerator {
    private List<Booking> bookings;
    private List<Movies> movies;
    private List<User> users;

    public ReportGenerator(List<Booking> bookings, List<Movies> movies, List<User> users) {
        this.bookings = bookings;
        this.movies = movies;
        this.users = users;
    }

    public String generateDailyReport(String date) {
        double dailyRevenue = 0;
        int bookingCount = 0;
        
        for (Booking b : bookings) {
            if (b.getBookingDate().equals(date)) {
                dailyRevenue += b.getTotalPrice();
                bookingCount++;
            }
        }
        
        return "Daily Report for " + date + 
               "\nTotal Bookings: " + bookingCount + 
               "\nTotal Revenue: $" + dailyRevenue;
    }

    public String generateMovieReport() {
        StringBuilder sb = new StringBuilder("Movie Popularity Report\n");
        for (Movies m : movies) {
            sb.append(m.getMovieName()).append(": ")
              .append(countMovieBookings(m.getId())).append(" bookings\n");
        }
        return sb.toString();
    }

    private int countMovieBookings(long movieId) {
        int count = 0;
        for (Booking b : bookings) {
            if (b.getShowId() == movieId) count++;
        }
        return count;
    }

    public String generateUserReport() {
        StringBuilder sb = new StringBuilder("User Statistics\n");
        sb.append("Total Users: ").append(users.size()).append("\n");
        
        int guests = 0, receptionists = 0, admins = 0;
        for (User u : users) {
            if (u instanceof Guest) guests++;
            else if (u instanceof Receptionist) receptionists++;
            else if (u instanceof Admin) admins++;
        }
        
        sb.append("Guests: ").append(guests).append("\n");
        sb.append("Receptionists: ").append(receptionists).append("\n");
        sb.append("Admins: ").append(admins).append("\n");
        
        return sb.toString();
    }

    public List<String> getTopMovies(int limit) {
        List<String> topMovies = new ArrayList<>();
        for (Movies m : movies) {
            topMovies.add(m.getMovieName());
            if (topMovies.size() >= limit) break;
        }
        return topMovies;
    }
}