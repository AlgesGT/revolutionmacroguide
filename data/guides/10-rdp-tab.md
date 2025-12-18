# RDP Configuration Guide

This includes how to setup the macro to an already existing Remote Desktop Protocol.

## Requirements

An Already set-up Remote Desktop Protocol
Your local IP address

## How to get your Local IP Address Using PowerShell
If your computer has multiple network interfaces (such as Ethernet, Wi-Fi, or VPN), you may want to determine the local IP address of the interface that's connected to your network or internet.

Enter Windows+R and type powershell
Enter the following command:
    Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.IPAddress -match '^10\.' -or
        $_.IPAddress -match '^172\.(1[6-9]|2[0-9]|3[0-1])\.' -or
        $_.IPAddress -match '^192\.168\.'
    } |
    Select-Object InterfaceAlias, IPAddress

What This Does:
Lists all private IPv4 addresses (local network IPs).
Displays each address alongside its interface name (e.g., Ethernet, Wi-Fi).

How to Choose the Right IP:
Pick the IP address associated with your preferred network interface typically the one you use to access the internet.
If you can’t connect to your relay using one interface, try using the IP from another listed interface.

Revolution Macro uses port 1234
An example of a good Relay address is: 10.222.30.14:1234

## Connecting a Relay 

Go into the Settings tab and click on Networking. Afterwards, click on the +. It will displays a new GUI which has an Identity text bar and an Address text bar. Add any name to your Relay and put the Relay Address in the Address text bar.

Start your relay and it should work.1