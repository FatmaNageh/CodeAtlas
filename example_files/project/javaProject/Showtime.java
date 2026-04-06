package application;

import java.util.ArrayList;
import java.util.List;

public class Showtime {
    private long showtimeId;
    private long movieId;
    private long hallId;
    private String startTime;
    private String endTime;
    private String date;
    private double ticketPrice;
    private int availableSeats;
    private List<Long> bookedSeats;

    public Showtime(long showtimeId, long movieId, long hallId, String startTime, String endTime, String date, double ticketPrice, int totalSeats) {
        this.showtimeId = showtimeId;
        this.movieId = movieId;
        this.hallId = hallId;
        this.startTime = startTime;
        this.endTime = endTime;
        this.date = date;
        this.ticketPrice = ticketPrice;
        this.availableSeats = totalSeats;
        this.bookedSeats = new ArrayList<>();
    }

    public long getShowtimeId() { return showtimeId; }
    public void setShowtimeId(long showtimeId) { this.showtimeId = showtimeId; }
    public long getMovieId() { return movieId; }
    public void setMovieId(long movieId) { this.movieId = movieId; }
    public long getHallId() { return hallId; }
    public void setHallId(long hallId) { this.hallId = hallId; }
    public String getStartTime() { return startTime; }
    public void setStartTime(String startTime) { this.startTime = startTime; }
    public String getEndTime() { return endTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }
    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }
    public double getTicketPrice() { return ticketPrice; }
    public void setTicketPrice(double ticketPrice) { this.ticketPrice = ticketPrice; }
    public int getAvailableSeats() { return availableSeats; }
    public void setAvailableSeats(int availableSeats) { this.availableSeats = availableSeats; }

    public boolean bookSeat(long seatId) {
        if (availableSeats > 0 && !bookedSeats.contains(seatId)) {
            bookedSeats.add(seatId);
            availableSeats--;
            return true;
        }
        return false;
    }

    public boolean cancelSeat(long seatId) {
        if (bookedSeats.remove(seatId)) {
            availableSeats++;
            return true;
        }
        return false;
    }

    public boolean isAvailable() {
        return availableSeats > 0;
    }

    @Override
    public String toString() {
        return "Showtime{movieId=" + movieId + ", hallId=" + hallId + ", date=" + date + ", time=" + startTime + "}";
    }
}