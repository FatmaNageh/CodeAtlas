package application;

import java.util.ArrayList;

public class Seat {

	private int SeatNumber;
	static int countSeat = 0;
	Hall hall;
	boolean reserved = false;

	public Seat(Hall hall) {
		countSeat += 1;
		this.SeatNumber = countSeat;
		this.hall = hall;
	}

	public int getSeatNumber() {
		return SeatNumber;
	}

	public void setSeatNumber(int seatNumber) {
		SeatNumber = seatNumber;
	}

	public Hall getHallnum() {
		return hall;
	}

	public void setHallnum(Hall hall) {
		this.hall = hall;
	}
	
	public String toString() {
		String num = Integer.toString(SeatNumber);
		return num;
	}
}
