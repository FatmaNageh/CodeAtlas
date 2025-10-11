package application;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.ArrayList;



/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */

public class User {
	private static int allUsers = 1;
	private String first_name;
	private String Last_name;
	private int id;
	private Role role;
	private String userName;
	private String Password;

	public User(String first_name, String Last_name, String role) {
		this.first_name = first_name;
		this.Last_name = Last_name;
		this.id = allUsers;
		this.role = Role.valueOf(role);
		allUsers += 1;
	}

	public void set_id(int id) {
		this.id = id;
	}

	public int get_id() {
		return id;
	}

	public void Set_FirstName(String first_name) {
		this.first_name = first_name;
	}

	public String get_FirstName() {
		return first_name;
	}

	public Role getRole() {
		return role;
	}

	public String getRoleAsString() {
		return role.name(); // or return role.toString();
	}

	public void setRole(String role) {
		this.role = Role.valueOf(role);
	}

	public String getUserName() {
		return userName;
	}

	public void setUserName(String userName) {
		this.userName = userName;
	}

	public String getPassword() {
		return Password;
	}

	public void setPassword(String password) {
		Password = password;
	}

	public String getLast_name() {
		return Last_name;
	}

	public void setLast_name(String last_name) {
		Last_name = last_name;
	}

	public static User checkUnAndPass(String UserName, String Password) throws FileNotFoundException, IOException {

		ArrayList<User> user = Admin.ReadUsers();
		for (User u : user) {
			if (u.getUserName().equals(UserName) && u.getPassword().equals(Password)) {
				return u;
			}
		}
		return null;
	}

	public static User SignIn(String UserName, String Password) throws IOException {
		ArrayList<User> x = Admin.ReadUsers();
		for (User u : x) {
			if (u.getUserName().equals(UserName) && u.getPassword().equals(Password)) {
				return u;
			}

		}
		return null;
	}

}
